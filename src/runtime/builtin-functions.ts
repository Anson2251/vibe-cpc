import { ParameterMode, PseudocodeType } from "../types";
import { RoutineInfo } from "./environment";

export const builtInFunctions: Record<string, Omit<RoutineInfo, 'name'>> = {
	LENGTH: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.INTEGER,
		isBuiltIn: true,
		implementation: (args) => (args[0] as string).length
	},
	LEFT: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'n', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => (args[0] as string).substring(0, (args[1] as number))
	},
	RIGHT: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'n', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => (args[0] as string).substring((args[0] as string).length - (args[1] as number))
	},
	MID: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'start', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }, { name: 'length', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => (args[0] as string).substring((args[1] as number), Math.min((args[1] as number) + (args[2] as number), (args[0] as string).length))
	}
}

export default builtInFunctions;
