import { ClassTypeInfo, ClassMethodInfo, TypeInfo, PseudocodeType } from "../types";
import type { RuntimeMethodInfo } from "../parser/ast-nodes";
import { NULL_POINTER } from "./heap";

export function resolveFullClassDefinition(
    className: string,
    classDefinitions: Map<string, ClassTypeInfo>,
    resolvedClassCache: Map<string, ClassTypeInfo>,
): ClassTypeInfo | undefined {
    const cached = resolvedClassCache.get(className);
    if (cached) return cached;

    const result = computeFullClassDefinition(className, classDefinitions);
    if (result) resolvedClassCache.set(className, result);
    return result;
}

function computeFullClassDefinition(
    className: string,
    classDefinitions: Map<string, ClassTypeInfo>,
): ClassTypeInfo | undefined {
    const classDef = classDefinitions.get(className);
    if (!classDef) return undefined;

    if (!classDef.inherits) return classDef;

    const parentDef = computeFullClassDefinition(classDef.inherits, classDefinitions);
    if (!parentDef) return classDef;

    const mergedFields: Record<string, TypeInfo> = { ...parentDef.fields, ...classDef.fields };
    const mergedFieldVisibility: Record<string, "PUBLIC" | "PRIVATE"> = {
        ...parentDef.fieldVisibility,
        ...classDef.fieldVisibility,
    };
    const mergedMethods: Record<string, ClassMethodInfo> = {
        ...parentDef.methods,
        ...classDef.methods,
    };

    return {
        ...classDef,
        fields: mergedFields,
        fieldVisibility: mergedFieldVisibility,
        methods: mergedMethods,
    };
}

export function findMethodInHierarchy(
    className: string,
    methodName: string,
    classMethodBodies: Map<string, Map<string, RuntimeMethodInfo>>,
    classDefinitions: Map<string, ClassTypeInfo>,
): RuntimeMethodInfo | undefined {
    const methodBodies = classMethodBodies.get(className);
    if (methodBodies) {
        const method = methodBodies.get(methodName);
        if (method) return method;
    }

    const classDef = classDefinitions.get(className);
    if (classDef?.inherits) {
        return findMethodInHierarchy(
            classDef.inherits,
            methodName,
            classMethodBodies,
            classDefinitions,
        );
    }

    return undefined;
}

export function getDefaultValue(type: TypeInfo): unknown {
    if (typeof type === "string") {
        switch (type) {
            case PseudocodeType.INTEGER:
            case PseudocodeType.REAL:
                return 0;
            case PseudocodeType.CHAR:
                return " ";
            case PseudocodeType.STRING:
                return "";
            case PseudocodeType.BOOLEAN:
                return false;
            case PseudocodeType.DATE:
                return new Date(0);
            case PseudocodeType.ANY:
                return null;
            default:
                return undefined;
        }
    }

    if (typeof type === "object" && "kind" in type && type.kind === "ENUM") {
        return type.values[0] ?? "";
    }

    if (typeof type === "object" && "kind" in type && type.kind === "SET") {
        return new Set();
    }

    if (typeof type === "object" && "kind" in type && type.kind === "POINTER") {
        return NULL_POINTER;
    }

    if (typeof type === "object" && "kind" in type && type.kind === "CLASS") {
        return NULL_POINTER;
    }

    if (typeof type === "object" && "elementType" in type) {
        return [];
    }

    if (typeof type === "object" && "fields" in type) {
        const result: Record<string, unknown> = {};
        for (const [fieldName, fieldType] of Object.entries(type.fields)) {
            result[fieldName] = getDefaultValue(fieldType);
        }
        return result;
    }

    return undefined;
}

export function resolveArrayElementType(arrayType: TypeInfo, indexCount: number): TypeInfo {
    let currentType: TypeInfo = arrayType;
    for (let i = 0; i < indexCount; i++) {
        if (
            typeof currentType === "object" &&
            currentType !== null &&
            "elementType" in currentType
        ) {
            currentType = currentType.elementType;
        } else {
            break;
        }
    }
    return currentType;
}
