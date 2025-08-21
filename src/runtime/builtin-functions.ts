import { ParameterMode, PseudocodeType } from "../types";
import { RoutineInfo } from "./environment";

export const builtInFunctions: Record<string, Omit<RoutineInfo, 'name'>> = {
	LENGTH: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.INTEGER,
		isBuiltIn: true,
		implementation: (args) => args[0].length
	},
	LEFT: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'n', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => args[0].substring(0, args[1])
	},
	RIGHT: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'n', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => args[0].substring(args[0].length - args[1])
	},
	MID: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'start', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }, { name: 'length', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => args[0].substring(args[1], Math.min(args[1] + args[2], args[0].length))
	}
}

export default builtInFunctions;
