export interface VerificationResult {
	fileName: string;
	criticalErrors: string[];
	warnings: string[];
}

export function isHDLFile(fileName: string): boolean {
	const lower = fileName.toLowerCase();

	return (
		lower.endsWith(".v") ||
		lower.endsWith(".sv") ||
		lower.endsWith(".vhd") ||
		lower.endsWith(".vhdl")
	);
}

export function runChecks(text: string, fileName: string): VerificationResult {
	const warnings: string[] = [];
	const criticalErrors: string[] = [];

	const isVhdl =
		fileName.toLowerCase().endsWith(".vhd") ||
		fileName.toLowerCase().endsWith(".vhdl");

	// ---------- Critical checks ----------

	if (!isVhdl) {
		if (!text.match(/\bmodule\s+\w+/i)) {
			criticalErrors.push("No Verilog module declaration found.");
		}

		if (!text.match(/\bendmodule\b/i)) {
			criticalErrors.push("Missing `endmodule`.");
		}
	}

	const beginCount = (text.match(/\bbegin\b/g) || []).length;
	const endCount = (text.match(/\bend\b/g) || []).length;

	if (!isVhdl && beginCount !== endCount) {
		criticalErrors.push(
			`Unbalanced begin/end blocks. Found ${beginCount} begin and ${endCount} end.`
		);
	}

	const openParenCount = (text.match(/\(/g) || []).length;
	const closeParenCount = (text.match(/\)/g) || []).length;

	if (openParenCount !== closeParenCount) {
		criticalErrors.push(
			`Unbalanced parentheses. Found ${openParenCount} "(" and ${closeParenCount} ")".`
		);
	}

	if (!text.match(/\binput\b/i) && !text.match(/\boutput\b/i) && !text.match(/\bport\b/i)) {
		criticalErrors.push(
			"No input/output ports detected. Testbench generation may fail."
		);
	}

	// ---------- Warning checks ----------

	if (!isVhdl && !text.includes("default_nettype none")) {
		warnings.push(
			"Consider adding `default_nettype none` to catch undeclared wires."
		);
	}

	const sequentialBlocks =
		text.match(/always\s*@\s*\([^)]*posedge[^)]*\)[\s\S]*?end/g) || [];

	const hasBlockingInSequential = sequentialBlocks.some(block =>
		/(?<![<>=!])=(?![=>=])/g.test(block)
	);

	if (!isVhdl && hasBlockingInSequential) {
		warnings.push(
			"Possible blocking assignment `=` inside sequential logic. Use `<=` for flip-flops."
		);
	}

	if (
		!isVhdl &&
		text.match(/always\s*@\s*\(\s*posedge|always_ff\s*@/i) &&
		!text.match(/reset|rst/i)
	) {
		warnings.push(
			"Sequential logic found, but no reset signal detected."
		);
	}

	if (
		!isVhdl &&
		text.match(/\bcase\s*\(/i) &&
		!text.match(/\bdefault\s*:/i)
	) {
		warnings.push(
			"Case statement found without a `default` branch."
		);
	}

	if (
		!isVhdl &&
		text.match(/always\s*@\s*\*/i) &&
		!text.match(/\belse\b/i)
	) {
		warnings.push(
			"Combinational block may infer a latch. Check for missing `else` or default assignments."
		);
	}

	return {
		fileName,
		criticalErrors,
		warnings
	};
}