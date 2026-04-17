import { ParameterMode, PseudocodeType } from "../types";
import { RoutineInfo } from "./environment";
import { z } from "zod";

type BuiltInScalarType =
    | PseudocodeType.STRING
    | PseudocodeType.INTEGER
    | PseudocodeType.REAL
    | PseudocodeType.BOOLEAN
    | PseudocodeType.CHAR
    | PseudocodeType.DATE
    | PseudocodeType.ANY;

type BuiltInParameter = {
    name: string;
    type: BuiltInScalarType;
    mode: ParameterMode;
};

function byValue(name: string, type: BuiltInScalarType): BuiltInParameter {
    return { name, type, mode: ParameterMode.BY_VALUE };
}

function schemaForType(type: BuiltInScalarType): z.ZodType {
    if (type === PseudocodeType.ANY) {
        return z.unknown();
    }
    switch (type) {
        case PseudocodeType.STRING:
            return z.coerce.string();
        case PseudocodeType.INTEGER:
            return z.coerce.number().int();
        case PseudocodeType.REAL:
            return z.coerce.number();
        case PseudocodeType.BOOLEAN:
            return z.coerce.boolean();
        case PseudocodeType.CHAR:
            return z.coerce.string().transform((value) => value.charAt(0));
        case PseudocodeType.DATE:
            return z.coerce.date();
    }
}

function defineBuiltIn(
    parameters: BuiltInParameter[],
    returnType: BuiltInScalarType,
    implementation: (...args: unknown[]) => unknown,
): Omit<RoutineInfo, "name"> {
    const schemas = parameters.map((parameter) => schemaForType(parameter.type));
    const outputSchema = schemaForType(returnType);
    const validatedImplementation = z
        .function({
            input: [z.array(z.unknown()).length(schemas.length)],
            output: outputSchema,
        })
        .implement((rawArgs) => {
            const parsedArgs = schemas.map((schema, index) => schema.parse(rawArgs[index]));
            return implementation(...parsedArgs);
        });

    return {
        parameters,
        returnType,
        isBuiltIn: true,
        implementation: (...args) => validatedImplementation(args),
    };
}

function parseNumericString(value: unknown): number {
    const text = String(value).trim();
    if (text.length === 0) {
        throw new Error("STR_TO_NUM expects a non-empty numeric string");
    }
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) {
        throw new Error("STR_TO_NUM expects a valid numeric string");
    }
    return numeric;
}

function ensureDate(value: unknown): Date {
    if (!(value instanceof Date)) {
        throw new Error("Expected DATE value");
    }
    return value;
}

export const builtInFunctions: Record<string, Omit<RoutineInfo, "name">> = {
    LENGTH: defineBuiltIn(
        [byValue("str", PseudocodeType.STRING)],
        PseudocodeType.INTEGER,
        (str) => String(str).length,
    ),
    TO_UPPER: defineBuiltIn([byValue("x", PseudocodeType.STRING)], PseudocodeType.STRING, (x) =>
        String(x).toUpperCase(),
    ),
    TO_LOWER: defineBuiltIn([byValue("x", PseudocodeType.STRING)], PseudocodeType.STRING, (x) =>
        String(x).toLowerCase(),
    ),
    NUM_TO_STR: defineBuiltIn([byValue("x", PseudocodeType.REAL)], PseudocodeType.STRING, (x) =>
        String(x),
    ),
    STR_TO_NUM: defineBuiltIn([byValue("x", PseudocodeType.STRING)], PseudocodeType.REAL, (x) =>
        parseNumericString(x),
    ),
    IS_NUM: defineBuiltIn(
        [byValue("str", PseudocodeType.STRING)],
        PseudocodeType.BOOLEAN,
        (str) => {
            const text = String(str).trim();
            if (text.length === 0) {
                return false;
            }
            return Number.isFinite(Number(text));
        },
    ),
    ASC: defineBuiltIn([byValue("ch", PseudocodeType.CHAR)], PseudocodeType.INTEGER, (ch) =>
        String(ch).charCodeAt(0),
    ),
    CHR: defineBuiltIn([byValue("x", PseudocodeType.INTEGER)], PseudocodeType.CHAR, (x) => {
        const code = Number(x);
        if (!Number.isInteger(code) || code < 0 || code > 127) {
            throw new Error("CHR expects an integer between 0 and 127");
        }
        return String.fromCharCode(code);
    }),
    LCASE: defineBuiltIn([byValue("ch", PseudocodeType.CHAR)], PseudocodeType.CHAR, (ch) =>
        String(ch).toLowerCase().charAt(0),
    ),
    UCASE: defineBuiltIn([byValue("ch", PseudocodeType.CHAR)], PseudocodeType.CHAR, (ch) =>
        String(ch).toUpperCase().charAt(0),
    ),
    LEFT: defineBuiltIn(
        [byValue("str", PseudocodeType.STRING), byValue("n", PseudocodeType.INTEGER)],
        PseudocodeType.STRING,
        (str, n) => String(str).substring(0, Number(n)),
    ),
    RIGHT: defineBuiltIn(
        [byValue("str", PseudocodeType.STRING), byValue("n", PseudocodeType.INTEGER)],
        PseudocodeType.STRING,
        (str, n) => String(str).substring(String(str).length - Number(n)),
    ),
    MID: defineBuiltIn(
        [
            byValue("str", PseudocodeType.STRING),
            byValue("start", PseudocodeType.INTEGER),
            byValue("length", PseudocodeType.INTEGER),
        ],
        PseudocodeType.STRING,
        (str, start, length) => {
            const normalizedStr = String(str);
            const normalizedStart = Number(start) - 1;
            const normalizedLength = Number(length);
            return normalizedStr.substring(
                normalizedStart,
                Math.min(normalizedStart + normalizedLength, normalizedStr.length),
            );
        },
    ),
    INT: defineBuiltIn([byValue("x", PseudocodeType.REAL)], PseudocodeType.INTEGER, (x) =>
        Math.trunc(Number(x)),
    ),
    RAND: defineBuiltIn([byValue("x", PseudocodeType.INTEGER)], PseudocodeType.REAL, (x) => {
        const max = Number(x);
        if (max <= 0) {
            throw new Error("RAND argument must be greater than 0");
        }
        return Math.random() * max;
    }),
    DAY: defineBuiltIn(
        [byValue("dateValue", PseudocodeType.DATE)],
        PseudocodeType.INTEGER,
        (dateValue) => ensureDate(dateValue).getDate(),
    ),
    MONTH: defineBuiltIn(
        [byValue("dateValue", PseudocodeType.DATE)],
        PseudocodeType.INTEGER,
        (dateValue) => ensureDate(dateValue).getMonth() + 1,
    ),
    YEAR: defineBuiltIn(
        [byValue("dateValue", PseudocodeType.DATE)],
        PseudocodeType.INTEGER,
        (dateValue) => ensureDate(dateValue).getFullYear(),
    ),
    DAYINDEX: defineBuiltIn(
        [byValue("dateValue", PseudocodeType.DATE)],
        PseudocodeType.INTEGER,
        (dateValue) => ensureDate(dateValue).getDay() + 1,
    ),
    SETDATE: defineBuiltIn(
        [
            byValue("day", PseudocodeType.INTEGER),
            byValue("month", PseudocodeType.INTEGER),
            byValue("year", PseudocodeType.INTEGER),
        ],
        PseudocodeType.DATE,
        (day, month, year) => new Date(Number(year), Number(month) - 1, Number(day)),
    ),
    POSITION: defineBuiltIn(
        [byValue("str", PseudocodeType.STRING), byValue("sub", PseudocodeType.STRING)],
        PseudocodeType.INTEGER,
        (str, sub) => {
            const idx = String(str).indexOf(String(sub));
            return idx === -1 ? 0 : idx + 1;
        },
    ),
    ROUND: defineBuiltIn(
        [byValue("x", PseudocodeType.REAL), byValue("dp", PseudocodeType.INTEGER)],
        PseudocodeType.REAL,
        (x, dp) => {
            const factor = Math.pow(10, Number(dp));
            return Math.round(Number(x) * factor) / factor;
        },
    ),
    ABS: defineBuiltIn([byValue("x", PseudocodeType.REAL)], PseudocodeType.REAL, (x) =>
        Math.abs(Number(x)),
    ),
    SQRT: defineBuiltIn([byValue("x", PseudocodeType.REAL)], PseudocodeType.REAL, (x) => {
        const val = Number(x);
        if (val < 0) {
            throw new Error("SQRT expects a non-negative value");
        }
        return Math.sqrt(val);
    }),
    REPLACE: defineBuiltIn(
        [
            byValue("str", PseudocodeType.STRING),
            byValue("old", PseudocodeType.STRING),
            byValue("new", PseudocodeType.STRING),
        ],
        PseudocodeType.STRING,
        (str, old, newStr) => String(str).split(String(old)).join(String(newStr)),
    ),
    TRIM: defineBuiltIn([byValue("str", PseudocodeType.STRING)], PseudocodeType.STRING, (str) =>
        String(str).trim(),
    ),
    POWER: defineBuiltIn(
        [byValue("x", PseudocodeType.REAL), byValue("n", PseudocodeType.REAL)],
        PseudocodeType.REAL,
        (x, n) => Math.pow(Number(x), Number(n)),
    ),
    TODAY: defineBuiltIn([], PseudocodeType.DATE, () => new Date()),
};

export const EXTENDED_BUILTIN_NAMES: ReadonlySet<string> = new Set([
    "POSITION",
    "ROUND",
    "ABS",
    "SQRT",
    "REPLACE",
    "TRIM",
    "POWER",
    "TYPEOF",
]);

export default builtInFunctions;
