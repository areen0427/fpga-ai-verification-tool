import * as vscode from 'vscode';

type ResultKind = 'root' | 'file' | 'criticalGroup' | 'warningGroup' | 'critical' | 'warning';

class ResultItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly kind: ResultKind,
		public readonly children: ResultItem[] = []
	) {
		super(
			label,
			children.length > 0
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None
		);

		if (kind === 'critical') {
			this.iconPath = new vscode.ThemeIcon('error');
		}

		if (kind === 'warning') {
			this.iconPath = new vscode.ThemeIcon('warning');
		}

		if (kind === 'file') {
			this.iconPath = new vscode.ThemeIcon('file');
		}
	}
}

export class VerificationProvider implements vscode.TreeDataProvider<ResultItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<ResultItem | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private rootItems: ResultItem[] = [];

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	updateResults(fileName: string, criticalErrors: string[], warnings: string[]) {
		const fileItem = new ResultItem(
			`File: ${fileName.split('/').pop()}`,
			'file'
		);

		const criticalGroup = new ResultItem(
			`Critical Errors: ${criticalErrors.length}`,
			'criticalGroup',
			criticalErrors.map(error =>
				new ResultItem(error, 'critical')
			)
		);

		const warningGroup = new ResultItem(
			`Warnings: ${warnings.length}`,
			'warningGroup',
			warnings.map(warning =>
				new ResultItem(warning, 'warning')
			)
		);

		this.rootItems = [fileItem, criticalGroup, warningGroup];

		this.refresh();
	}

	getTreeItem(element: ResultItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ResultItem): Thenable<ResultItem[]> {
		if (element) {
			return Promise.resolve(element.children);
		}

		return Promise.resolve(this.rootItems);
	}
}