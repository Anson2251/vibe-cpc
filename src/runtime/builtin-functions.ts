import { ParameterMode, PseudocodeType } from "../types";
import { RoutineInfo } from "./environment";

export const builtInFunctions: Record<string, Omit<RoutineInfo, 'name'>> = {
	LENGTH: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.INTEGER,
		isBuiltIn: true,
		implementation: (args) => String(args[0]).length
	},
	LEFT: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'n', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => String(args[0]).substring(0, Number(args[1]))
	},
	RIGHT: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'n', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => {
			const str = String(args[0]);
			return str.substring(str.length - Number(args[1]));
		}
	},
	MID: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }, { name: 'start', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }, { name: 'length', type: PseudocodeType.INTEGER, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.STRING,
		isBuiltIn: true,
		implementation: (args) => {
			const str = String(args[0]);
			const start = Number(args[1]);
			const length = Number(args[2]);
			return str.substring(start, Math.min(start + length, str.length));
		}
	}
}

export default builtInFunctions;
