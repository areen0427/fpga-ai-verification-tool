export interface ParsedSimulationResult {
	compilePassed: boolean;
	simulationPassed: boolean;
	errors: string[];
	warnings: string[];
	rawLog: string;
	canAddToProject: boolean;
}

export function parseSimulationOutput(
	compileCode: number | null,
	simCode: number | null,
	output: string
): ParsedSimulationResult {
	const lines = output.split(/\r?\n/).filter(line => line.trim().length > 0);

	const errors = lines.filter(line => {
		const lower = line.toLowerCase();
		return (
			lower.includes("error") ||
			lower.includes("syntax error") ||
			lower.includes("unable to") ||
			lower.includes("failed") ||
			lower.includes("unknown module") ||
			lower.includes("undefined")
		);
	});

	const warnings = lines.filter(line =>
		line.toLowerCase().includes("warning")
	);

	const compilePassed = compileCode === 0 && errors.length === 0;
	const simulationPassed = simCode === 0 && errors.length === 0;

	return {
		compilePassed,
		simulationPassed,
		errors,
		warnings,
		rawLog: output,
		canAddToProject: compilePassed && simulationPassed && errors.length === 0
	};
}