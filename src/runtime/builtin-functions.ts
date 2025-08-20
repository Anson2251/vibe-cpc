import { ParameterMode, PseudocodeType } from "../types";
import { RoutineInfo } from "./environment";

export const builtInFunctions: Record<string, Omit<RoutineInfo, 'name'>> = {
	LEN: {
		parameters: [{ name: 'str', type: PseudocodeType.STRING, mode: ParameterMode.BY_VALUE }],
		returnType: PseudocodeType.INTEGER,
		isBuiltIn: true,
		implementation: (args) => args[0].length
	}
}

export default builtInFunctions;
