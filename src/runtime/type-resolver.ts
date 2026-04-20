import {
    RuntimeError,
    TypeInfo,
    UserDefinedTypeInfo,
    EnumTypeInfo,
    SetTypeInfo,
    PointerTypeInfo,
    ClassTypeInfo,
    ClassMethodInfo,
    PseudocodeType,
} from "./evaluator-types";
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

export function findMethodBody(
    className: string,
    methodName: string,
    classMethodBodies: Map<
        string,
        Map<string, { name: string; className: string; parameters: unknown[]; body: unknown[] }>
    >,
    classDefinitions: Map<string, ClassTypeInfo>,
): { name: string; className: string; parameters: unknown[]; body: unknown[] } | undefined {
    const methodBodies = classMethodBodies.get(className);
    if (methodBodies) {
        const method = methodBodies.get(methodName);
        if (method) return method;
    }

    const classDef = classDefinitions.get(className);
    if (classDef?.inherits) {
        return findMethodBody(classDef.inherits, methodName, classMethodBodies, classDefinitions);
    }

    return undefined;
}

export function resolveType(
    type: TypeInfo,
    userDefinedTypes: Map<string, UserDefinedTypeInfo>,
    enumTypes: Map<string, EnumTypeInfo>,
    setTypes: Map<string, SetTypeInfo>,
    pointerTypes: Map<string, PointerTypeInfo>,
    classDefinitions: Map<string, ClassTypeInfo>,
    line?: number,
    column?: number,
    resolving: Set<string> = new Set(),
): TypeInfo {
    if (typeof type === "string") {
        return type;
    }

    if (typeof type === "object" && "kind" in type) {
        if (type.kind === "POINTER") {
            return {
                kind: "POINTER",
                name: type.name,
                pointedType: resolveType(
                    type.pointedType,
                    userDefinedTypes,
                    enumTypes,
                    setTypes,
                    pointerTypes,
                    classDefinitions,
                    line,
                    column,
                    resolving,
                ),
            };
        }
        return type;
    }

    if (typeof type === "object" && "elementType" in type) {
        return {
            elementType: resolveType(
                type.elementType,
                userDefinedTypes,
                enumTypes,
                setTypes,
                pointerTypes,
                classDefinitions,
                line,
                column,
                resolving,
            ),
            bounds: type.bounds,
        };
    }

    if (Object.keys(type.fields).length > 0) {
        const resolvedFields: Record<string, TypeInfo> = {};
        for (const [fieldName, fieldType] of Object.entries(type.fields)) {
            resolvedFields[fieldName] = resolveType(
                fieldType,
                userDefinedTypes,
                enumTypes,
                setTypes,
                pointerTypes,
                classDefinitions,
                line,
                column,
                resolving,
            );
        }
        return {
            name: type.name,
            fields: resolvedFields,
        };
    }

    const lookupName = type.name.toUpperCase();
    if (resolving.has(lookupName)) {
        throw new RuntimeError(`Recursive type '${type.name}' is not supported`, line, column);
    }

    resolving.add(lookupName);
    const resolved = userDefinedTypes.get(type.name.toUpperCase());
    const resolvedEnum = enumTypes.get(type.name.toUpperCase());
    if (resolvedEnum) {
        resolving.delete(lookupName);
        return resolvedEnum;
    }
    const resolvedSet = setTypes.get(type.name.toUpperCase());
    if (resolvedSet) {
        resolving.delete(lookupName);
        return resolvedSet;
    }
    const resolvedPointer = pointerTypes.get(type.name.toUpperCase());
    if (resolvedPointer) {
        resolving.delete(lookupName);
        return resolvedPointer;
    }
    const resolvedClass = classDefinitions.get(type.name);
    if (resolvedClass) {
        resolving.delete(lookupName);
        return resolvedClass;
    }
    if (!resolved) {
        resolving.delete(lookupName);
        throw new RuntimeError(`Unknown type '${type.name}'`, line, column);
    }

    const resolvedFields: Record<string, TypeInfo> = {};
    for (const [fieldName, fieldType] of Object.entries(resolved.fields)) {
        resolvedFields[fieldName] = resolveType(
            fieldType,
            userDefinedTypes,
            enumTypes,
            setTypes,
            pointerTypes,
            classDefinitions,
            line,
            column,
            resolving,
        );
    }
    resolving.delete(lookupName);

    return {
        name: resolved.name,
        fields: resolvedFields,
    };
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
