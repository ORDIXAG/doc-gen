import {Component, NgZone, OnInit, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ApiService, GenerationStreamEvent, Muster, Model} from '../../services/api.service';
import {DocumentFile} from '../../models/document-file.model';
import {GeneratedDocumentation} from '../../models/generated-documentation.model';
import {forkJoin, Observable, Subscription} from 'rxjs';
import {NestedTreeControl} from '@angular/cdk/tree';
import {MatTreeNestedDataSource} from '@angular/material/tree';
import {MatDialog} from '@angular/material/dialog';
import {ChatDialogComponent} from '../../components/chat-dialog.component';
import {MatSelectChange} from '@angular/material/select';
import {Conversation} from '../../models/conversation.model';
import {CdkDragDrop} from '@angular/cdk/drag-drop';
import {MatSnackBar} from '@angular/material/snack-bar';

// Syntax Highlighting Colors
import 'prismjs';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';

declare let mermaid: any;

type SelectableItem = DocumentFile | GeneratedDocumentation;

export interface FileNode {
    name: string;
    path: string;
    isFolder: boolean;
    children?: FileNode[];
    originalDoc?: DocumentFile;
    gitId: number;
}

@Component({
    selector: 'dokumentationsgenerator-conversation-detail',
    templateUrl: './conversation-detail.component.html',
    styleUrls: ['./conversation-detail.component.scss'],
    standalone: false,
})
export class ConversationDetailComponent implements OnInit, OnDestroy {
    conversationId!: number;
    repoId!: string;
    git!: string;
    conversation: Conversation | undefined;
    files: DocumentFile[] = [];
    generatedDocs: GeneratedDocumentation[] = [];

    selectedItem: SelectableItem | undefined;
    displayContent: string | undefined;

    musterOptions: Muster[] = [];
    selectedMusterIdentifier: number | string = isNaN(Number(sessionStorage.getItem('selectedMusterIdentifier') || ''))
        ? sessionStorage.getItem('selectedMusterIdentifier') || ''
        : Number(sessionStorage.getItem('selectedMusterIdentifier') || '');

    modelOptions: Model[] = [];
    selectedModel: Model | undefined;

    isGenerating = false;
    isLoading = false;
    hasFolders = false;

    isEditingOrCreating = false;
    editableFile: Partial<DocumentFile> = {};
    editingGenerated = false;
    editableGenerated: Partial<GeneratedDocumentation> = {};

    generationProgress = 0;
    currentChapter = '';
    private generationSubscription: Subscription | null = null;

    showFilesTreeView = true;
    filesTreeControl = new NestedTreeControl<FileNode>(node => node.children);
    filesDataSource = new MatTreeNestedDataSource<FileNode>();

    canDrop = (drag: any, drop: any) => {
        // dragged node
        const dragData = drag.data;
        // target node (from drop list)
        const dropData = drop.data;

        if (!dropData) {
            return true;
        } // Dropping on empty space is allowed
        return dragData.path !== dropData.path; // Don't drop on self
    };

    constructor(
        private route: ActivatedRoute,
        private api: ApiService,
        private zone: NgZone,
        private dialog: MatDialog,
        private router: Router,
        private snackBar: MatSnackBar
    ) {}

    ngOnInit(): void {
        this.conversationId = Number(this.route.snapshot.paramMap.get('id'));
        if (this.conversationId) {
            this.loadData();
        }
        this.api.getModels().subscribe(models => {
            this.modelOptions = models;

            for (const model of this.modelOptions) {
                model.hint = '(' + model.hint + ')';
            }

            if (sessionStorage.getItem('selectedModel')) {
                this.selectedModel = this.modelOptions.find(m => m.name === sessionStorage.getItem('selectedModel'));
            }

            if (!this.selectedModel || !this.modelOptions.includes(this.selectedModel)) {
                this.selectedModel = this.modelOptions[0];
                sessionStorage.setItem('selectedModel', this.selectedModel.name);
            }
        });
        this.api.getMuster().subscribe(muster => {
            this.musterOptions = muster.sort((a, b) => a.name.localeCompare(b.name));
            if (
                !this.selectedMusterIdentifier ||
                !this.musterOptions.some(m => m.id === Number(this.selectedMusterIdentifier))
            ) {
                this.selectedMusterIdentifier = this.musterOptions[0].id ?? this.musterOptions[0].name;
                sessionStorage.setItem('selectedMusterIdentifier', this.selectedMusterIdentifier?.toString());
            }
        });
    }

    loadData(): void {
        this.isLoading = true;
        forkJoin({
            conversation: this.api.getConversation(this.conversationId),
            files: this.api.getFiles(this.conversationId),
            docs: this.api.getDocumentations(this.conversationId),
        }).subscribe({
            next: ({conversation, files, docs}) => {
                this.displayContent = undefined;
                this.conversation = conversation;
                this.files = files.sort((a, b) => a.path.localeCompare(b.path));
                this.generatedDocs = docs;
                this.filesDataSource.data = this.buildFileTree(this.files);
                this.isLoading = false;
                this.isEditingOrCreating = false;
                this.editingGenerated = false;
                this.editableGenerated = {};
            },
            error: err => {
                // eslint-disable-next-line no-console
                console.error('Failed to load conversation data', err);
                alert('Fehler beim Laden der Konversation: ' + err.error.detail);
                this.isLoading = false;
                this.router.navigate(['/conversations']);
            },
        });
    }

    selectItem(item: SelectableItem): void {
        this.selectedItem = item;
        this.prepareDisplayContent();
    }

    selectMuster(event: MatSelectChange): void {
        this.selectedMusterIdentifier = event.value;
        sessionStorage.setItem('selectedMusterIdentifier', this.selectedMusterIdentifier.toString());
    }

    selectModel(model: Model) {
        this.selectedModel = model;
        sessionStorage.setItem('selectedModel', this.selectedModel.name);
    }

    // Helper for the mat-tree template to identify expandable (folder) nodes
    hasChild = (_: number, node: FileNode) => node.isFolder && !!node.children && node.children.length > 0;

    selectFileTreeNode(node: FileNode): void {
        if (!node.isFolder && node.originalDoc) {
            this.selectItem(node.originalDoc);
        }
    }

    deleteTreeFile(node: FileNode): void {
        if (!node.isFolder && node.originalDoc) {
            this.deleteFile(node.originalDoc);
        }
    }

    deleteFile(file: DocumentFile): void {
        this.api.deleteFile(this.conversationId, file.id, file.path, file.git_id).subscribe(() => {
            this.loadData();
        });
    }

    deleteDocumentation(doc: GeneratedDocumentation): void {
        this.api.deleteDocumentation(this.conversationId, doc.id).subscribe(() => {
            this.loadData();
        });
    }

    deleteDirectory(node: FileNode): void {
        this.api.deleteDirectory(this.conversationId, node.path, node.gitId).subscribe(() => {
            this.loadData();
        });
    }

    createFile(): void {
        this.isEditingOrCreating = true;
        this.editableFile = {
            path: 'new-file.txt',
            content: '',
            // eslint-disable-next-line camelcase
            conversation_id: this.conversationId,
        };
        this.selectedItem = undefined;
        this.displayContent = undefined;
    }

    startEditFile(file: DocumentFile): void {
        this.isEditingOrCreating = true;
        this.editableFile = {...file};
        this.editingGenerated = false;
        this.editableGenerated = {};
        this.selectedItem = undefined;
        this.displayContent = undefined;
    }

    startEditTreeFile(node: FileNode): void {
        if (!node.isFolder && node.originalDoc) {
            this.startEditFile(node.originalDoc);
        }
    }

    startEditDocumentation(doc: GeneratedDocumentation): void {
        this.isEditingOrCreating = true;
        this.editingGenerated = true;
        this.editableGenerated = {...doc};
        this.selectedItem = undefined;
        this.displayContent = undefined;
    }

    cancelEdit(): void {
        this.isEditingOrCreating = false;
        this.editableFile = {};
        this.editingGenerated = false;
        this.editableGenerated = {};
    }

    saveFile(): void {
        if (this.editingGenerated) {
            if (
                !this.editableGenerated.path ||
                this.editableGenerated.content === undefined ||
                this.editableGenerated.content === null
            ) {
                this.snackBar.open('Pfad und Inhalt des Dokuments dürfen nicht leer sein.', 'Close', {duration: 5000});
                return;
            }

            if (this.editableGenerated.id) {
                // update existing generated documentation
                this.api.updateDocumentation(this.editableGenerated as GeneratedDocumentation).subscribe(
                    () => {
                        this.finishEditing();
                    },
                    err => {
                        // eslint-disable-next-line no-console
                        console.error('Failed to update documentation', err);
                        this.snackBar.open('Fehler beim Speichern: ' + (err.error?.detail ?? err.message), 'Close', {
                            duration: 5000,
                        });
                    }
                );
            } else {
                this.snackBar.open(
                    'Erstellen neuer generierter Dokumentation über den Editor wird nicht unterstützt.',
                    'Close',
                    {duration: 5000}
                );
            }
            return;
        }

        if (!this.editableFile.path || this.editableFile.content === undefined || this.editableFile.content === null) {
            this.snackBar.open('Pfad und Inhalt des Dokuments dürfen nicht leer sein.', 'Close', {duration: 5000});
            return;
        }

        if (this.editableFile.id) {
            // Existing file: call editFile
            this.api.editFile(this.editableFile as DocumentFile).subscribe(() => {
                this.finishEditing();
            });
        } else {
            // New file: call addFile
            const extension = this.editableFile.path?.split('.').pop() || '';
            const fileType = this.getMimeTypeFromExtension(extension);
            this.api
                .addFile(this.conversationId, this.editableFile.path!, this.editableFile.content!, fileType)
                .subscribe(() => {
                    this.finishEditing();
                });
        }
    }

    private finishEditing(): void {
        this.isEditingOrCreating = false;
        this.editableFile = {};
        this.editingGenerated = false;
        this.editableGenerated = {};
        this.loadData();
    }

    downloadDocumentation(documentation: GeneratedDocumentation): void {
        const blob = new Blob([documentation.content], {type: 'text/markdown'});
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = documentation.path;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    private getMimeTypeFromExtension(extension: string): string {
        switch (extension.toLowerCase()) {
            case 'txt':
                return 'text/plain';
            case 'md':
                return 'text/markdown';
            case 'html':
                return 'text/html';
            case 'css':
                return 'text/css';
            case 'js':
                return 'application/javascript';
            case 'json':
                return 'application/json';
            case 'ts':
                return 'application/x-typescript';
            default:
                return 'text/plain';
        }
    }

    private buildFileTree(docs: DocumentFile[]): FileNode[] {
        const rootNodes: FileNode[] = [];
        const nodeMap = new Map<string, FileNode>();
        this.hasFolders = false;

        docs.forEach(doc => {
            const pathParts = doc.path.split('/');
            let currentPath = '';
            let parentChildren = rootNodes;

            pathParts.forEach((part, index) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const isLastPart = index === pathParts.length - 1;

                if (!this.hasFolders && !isLastPart) {
                    this.hasFolders = true;
                }

                if (!nodeMap.has(currentPath)) {
                    const newNode: FileNode = {
                        name: part,
                        path: currentPath,
                        isFolder: !isLastPart,
                        children: isLastPart ? undefined : [],
                        originalDoc: isLastPart ? doc : undefined,
                        // eslint-disable-next-line camelcase
                        gitId: doc.git_id,
                    };
                    nodeMap.set(currentPath, newNode);
                    parentChildren.push(newNode);
                }

                if (!isLastPart) {
                    const folderNode = nodeMap.get(currentPath)!;
                    if (!folderNode.children) {
                        folderNode.children = [];
                    }
                    parentChildren = folderNode.children;
                }
            });
        });

        return rootNodes;
    }

    private prepareDisplayContent(): void {
        if (!this.selectedItem) {
            this.displayContent = undefined;
            return;
        }

        const path = this.selectedItem.path;
        let content = this.selectedItem.content;
        const extension = path.split('.').pop()?.toLowerCase();

        if (extension === 'md') {
            const mermaidRegex = /```mermaid([\s\S]*?)```/gs;
            content = content.replace(mermaidRegex, (match, mermaidContent) => {
                return `<div class="mermaid">\n${mermaidContent.trim().replace('```mermaid', '').replace('```', '')}\n</div>`;
            });
            this.displayContent = content;
        } else {
            const language = this.getLanguageFromExtension(extension);
            this.displayContent = '```' + language + '\n' + content + '\n```';
        }
    }

    public onMarkdownReady(): void {
        try {
            if (typeof mermaid !== 'undefined') {
                mermaid.run();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Could not render mermaid graph.', e);
        }
    }

    private getLanguageFromExtension(extension: string | undefined): string {
        switch (extension) {
            case 'js':
                return 'javascript';
            case 'ts':
                return 'typescript';
            case 'py':
                return 'python';
            case 'java':
                return 'java';
            case 'html':
            case 'xml':
                return 'markup'; // 'markup' is the language for HTML/XML in Prism
            case 'css':
                return 'css';
            case 'scss':
                return 'scss';
            case 'json':
                return 'json';
            default:
                return 'text';
        }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files) {
            return;
        }

        this.isLoading = true;

        for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            const reader = new FileReader();
            reader.onload = e => {
                const content = e.target?.result as string;
                this.api.addFile(this.conversationId, file.name, content, file.type).subscribe(
                    () => {
                        this.api.getFiles(this.conversationId).subscribe(files => {
                            this.files = files.sort((a, b) => a.path.localeCompare(b.path));
                            this.filesDataSource.data = this.buildFileTree(this.files);
                        });
                    },
                    err => {
                        this.isLoading = false;
                        // eslint-disable-next-line no-console
                        console.log('Failed to add file: ' + err.error.detail);
                    },
                    () => (this.isLoading = false)
                );
            };
            reader.readAsText(file);
        }
    }

    onFolderSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            return;
        }

        this.isLoading = true;
        const files = Array.from(input.files);
        const uploadObservables: Observable<any>[] = [];

        for (const file of files) {
            const fileUploadObservable = new Observable(observer => {
                if (!file.type && file.size === 0) {
                    observer.next(null);
                    observer.complete();
                    return;
                }

                const reader = new FileReader();
                reader.onload = e => {
                    const content = e.target?.result as string;

                    this.api.addFile(this.conversationId, file.webkitRelativePath, content, file.type).subscribe({
                        next: response => {
                            observer.next(response);
                            observer.complete();
                        },
                        error: err => observer.error(err),
                    });
                };
                reader.onerror = err => observer.error(err);
                reader.readAsText(file);
            });
            uploadObservables.push(fileUploadObservable);
        }

        if (uploadObservables.length === 0) {
            return;
        }

        forkJoin(uploadObservables).subscribe({
            next: () => {
                this.api.getFiles(this.conversationId).subscribe(_files => {
                    this.files = _files.sort((a, b) => a.path.localeCompare(b.path));
                    this.filesDataSource.data = this.buildFileTree(this.files);
                });
            },
            error: err => {
                // eslint-disable-next-line no-console
                console.error('An error occurred during folder upload:', err);
                this.isLoading = false;
            },
            complete: () => {
                this.isLoading = false;
            },
        });
    }

    addRepository(): void {
        const repoFullIdentifier =
            prompt('GitHub ID des Repositories:\nz.B. ORDIXAG/doc-gen', 'ORDIXAG/doc-gen') || '';
        if (!repoFullIdentifier) {
            return;
        }
        this.isLoading = true;
        this.git = repoFullIdentifier.toString().substring(0, repoFullIdentifier.toString().indexOf('/'));
        this.repoId = repoFullIdentifier.toString().substring(repoFullIdentifier.toString().indexOf('/') + 1);
        this.api.addRepository(this.conversationId, this.git, this.repoId).subscribe({
            next: () => {
                this.loadData();
                this.isLoading = false;
            },
            error: err => {
                // eslint-disable-next-line no-console
                console.error('Failed to add repository', err);
                this.snackBar.open('Fehler beim Hinzufügen des Repositories: ' + err.error.detail, 'Close', {
                    duration: 5000,
                });
                this.isLoading = false;
            },
        });
    }

    generate(): void {
        if (!this.selectedMusterIdentifier) {
            this.snackBar.open('Bitte wählen Sie ein Muster aus.', 'Close', {duration: 5000});
            return;
        }

        this.isGenerating = true;
        this.generationProgress = 0;
        this.currentChapter = 'Initialisiere...';
        this.displayContent = '';

        if (this.generationSubscription) {
            this.generationSubscription.unsubscribe();
        }

        const selectedMuster = this.musterOptions.find(
            m =>
                (m.is_predefined && m.name === this.selectedMusterIdentifier) ||
                (!m.is_predefined && m.id === this.selectedMusterIdentifier)
        );

        if (!selectedMuster) {
            this.snackBar.open('Ausgewähltes Muster nicht gefunden.', 'Close', {duration: 5000});
            this.isGenerating = false;
            return;
        }

        const mermaidRegex = /```mermaid([\s\S]*?)```/gs;

        this.generationSubscription = this.api
            .generateDocumentationStream(
                this.conversationId,
                this.repoId,
                this.selectedModel!.name,
                selectedMuster.is_predefined ? undefined : selectedMuster.id,
                selectedMuster.is_predefined ? selectedMuster.name : undefined
            )
            .subscribe({
                next: (event: GenerationStreamEvent) => {
                    this.zone.run(() => {
                        switch (event.status) {
                            case 'generating':
                                this.generationProgress = event.progress ?? this.generationProgress;
                                this.currentChapter = event.chapter ?? this.currentChapter;
                                break;

                            case 'content':
                                const unescapedChunk = (event.chunk ?? '')
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\t/g, '\t')
                                    .replace(/\\r/g, '\r');

                                this.displayContent += unescapedChunk;

                                this.displayContent = this.displayContent?.replace(
                                    mermaidRegex,
                                    (match, mermaidContent) => {
                                        // eslint-disable-next-line max-len
                                        return `<div class="mermaid">\n${mermaidContent.trim().replace('```mermaid', '').replace('```', '')}\n</div>`;
                                    }
                                );

                                break;

                            case 'complete':
                                this.currentChapter = 'Fertig!';
                                this.generationProgress = 100;
                                this.isGenerating = false;
                                this.loadData(); // Reload the list of generated documents
                                this.displayContent = this.displayContent?.replace(
                                    mermaidRegex,
                                    (match, mermaidContent) => {
                                        // eslint-disable-next-line max-len
                                        return `<div class="mermaid">\n${mermaidContent.trim().replace('```mermaid', '').replace('```', '')}\n</div>`;
                                    }
                                );
                                if (!this.displayContent) {
                                    this.displayContent = 'Es gab ein Fehler bei der Generierung.';
                                    this.snackBar.open(
                                        'Es gab ein Fehler bei der Generierung. Probiere es nochmals.',
                                        'Close',
                                        {duration: 5000}
                                    );
                                }
                                break;

                            case 'error':
                                // eslint-disable-next-line no-console
                                console.error('Error during generation:', event.message);
                                this.snackBar.open(`Fehler bei der Generierung: ${event.message}`, 'Close', {
                                    duration: 5000,
                                });
                                this.isGenerating = false;
                                break;

                            default:
                                break;
                        }
                    });
                },
                error: err => {
                    this.zone.run(() => {
                        // eslint-disable-next-line no-console
                        console.error('Stream connection failed:', err);
                        this.snackBar.open(
                            'Ein Fehler ist bei der Verbindung zum Server aufgetreten: ' + err.error.detail,
                            'Close',
                            {duration: 5000}
                        );
                        this.isGenerating = false;
                    });
                },
                complete: () => {
                    // eslint-disable-next-line no-console
                    console.log('Generation stream completed.');
                },
            });
    }

    openChat(): void {
        this.dialog.open(ChatDialogComponent, {
            width: 'clamp(500px, 70vw, 900px)',
            height: '85vh',
            data: {
                conversationId: this.conversationId,
                model: this.selectedModel,
            },
        });
    }

    handleDrop(event: CdkDragDrop<any>, targetNode?: any) {
        const draggedNode = event.item.data;

        // Prevent action if dropping on itself
        if (targetNode && draggedNode.path === targetNode.path) {
            return;
        }

        let targetPath = '';

        if (!targetNode) {
            // Case 1: Target is empty space
            targetPath = '';
        } else if (targetNode.isFolder) {
            // Case 2: Target is a folder -> Path is the folder's path
            targetPath = targetNode.path;
        } else {
            // Case 3: Target is a file -> Path is the file's parent folder
            const lastIndex = targetNode.path.lastIndexOf('/');

            if (lastIndex > -1) {
                targetPath = targetNode.path.substring(0, lastIndex);
            } else {
                // File is at root
                targetPath = '';
            }
        }

        if (draggedNode.path.substring(0, draggedNode.path.lastIndexOf('/')) === targetPath) {
            // would move to the same path
            return;
        }

        this.api.moveTree(this.conversationId, draggedNode, targetPath).subscribe({
            next: () => {
                this.loadData();
            },
            error: err => {
                this.snackBar.open('Fehler beim Verschieben: ' + err.error.detail, 'Close', {duration: 5000});
            },
        });
    }

    ngOnDestroy(): void {
        if (this.generationSubscription) {
            this.generationSubscription.unsubscribe();
        }
    }
}
