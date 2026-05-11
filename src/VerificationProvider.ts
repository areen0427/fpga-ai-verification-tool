import * as vscode from 'vscode';
import { VerificationResult } from './checker';

type ResultKind =
	| 'file'
	| 'criticalGroup'
	| 'warningGroup'
	| 'critical'
	| 'warning'
	| 'success';

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

		if (kind === 'success') {
			this.iconPath = new vscode.ThemeIcon('check');
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

	updateResults(results: VerificationResult[]) {
		this.rootItems = results.map(result => {
			const fileName = result.fileName.split(/[\\/]/).pop() || result.fileName;

			const children: ResultItem[] = [];

			if (result.criticalErrors.length > 0) {
				children.push(
					new ResultItem(
						`Critical Errors: ${result.criticalErrors.length}`,
						'criticalGroup',
						result.criticalErrors.map(error =>
							new ResultItem(error, 'critical')
						)
					)
				);
			}

			if (result.warnings.length > 0) {
				children.push(
					new ResultItem(
						`Warnings: ${result.warnings.length}`,
						'warningGroup',
						result.warnings.map(warning =>
							new ResultItem(warning, 'warning')
						)
					)
				);
			}

			if (children.length === 0) {
				children.push(
					new ResultItem(
						"No issues found.",
						'success'
					)
				);
			}

			return new ResultItem(
				fileName,
				'file',
				children
			);
		});

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