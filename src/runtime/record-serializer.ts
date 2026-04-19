import { Heap } from "./heap";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function serializeRecord(value: unknown, heap: Heap): string {
    if (isRecord(value)) {
        const fields: string[] = [];
        for (const [key, addr] of Object.entries(value)) {
            if (typeof addr === "number") {
                try {
                    const obj = heap.read(addr);
                    fields.push(`${key}=${serializeRecord(obj.value, heap)}`);
                } catch {}
            } else {
                fields.push(`${key}=${serializeRecord(addr, heap)}`);
            }
        }
        return `{${fields.join(",")}}`;
    }
    if (Array.isArray(value)) {
        const items = value.map((addr) => {
            if (typeof addr === "number") {
                try {
                    const obj = heap.read(addr);
                    return serializeRecord(obj.value, heap);
                } catch {}
            }
            return String(addr);
        });
        return `[${items.join(",")}]`;
    }
    return String(value);
}

export function parseRecordData(data: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!data.startsWith("{") || !data.endsWith("}")) {
        throw new Error(`Invalid record format: ${data}`);
    }

    const content = data.slice(1, -1);
    let depth = 0;
    let currentKey = "";
    let currentValue = "";
    let isReadingKey = true;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (char === "{" || char === "[") {
            depth++;
            if (isReadingKey) {
                currentKey += char;
            } else {
                currentValue += char;
            }
        } else if (char === "}" || char === "]") {
            depth--;
            if (isReadingKey) {
                currentKey += char;
            } else {
                currentValue += char;
            }
        } else if (char === "=" && depth === 0 && isReadingKey) {
            isReadingKey = false;
        } else if (char === "," && depth === 0) {
            if (currentKey) {
                result[currentKey.trim()] = currentValue.trim();
            }
            currentKey = "";
            currentValue = "";
            isReadingKey = true;
        } else {
            if (isReadingKey) {
                currentKey += char;
            } else {
                currentValue += char;
            }
        }
    }

    if (currentKey) {
        result[currentKey.trim()] = currentValue.trim();
    }

    return result;
}

export function reconstructRecord(
    parsed: Record<string, string>,
    target: Record<string, unknown>,
    heap: Heap,
): void {
    for (const [key, value] of Object.entries(target)) {
        if (parsed[key] === undefined) continue;

        const parsedValue = parsed[key];

        if (typeof value === "number") {
            try {
                const obj = heap.readUnsafe(value);
                if (isRecord(obj.value)) {
                    const nestedParsed = parseRecordData(parsedValue);
                    reconstructRecord(nestedParsed, obj.value, heap);
                } else if (Array.isArray(obj.value)) {
                    heap.write(value, parseValue(parsedValue), obj.type);
                } else {
                    heap.write(value, parseValue(parsedValue), obj.type);
                }
            } catch {}
        } else if (isRecord(value)) {
            const nestedParsed = parseRecordData(parsedValue);
            reconstructRecord(nestedParsed, value, heap);
        }
    }
}

function parseValue(value: string): unknown {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value.startsWith("{") || value.startsWith("[")) return value;
    const num = Number(value);
    if (!isNaN(num)) return num;
    return value;
}
