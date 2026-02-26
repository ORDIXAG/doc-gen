import {Injectable} from '@angular/core';
import {HttpClient, HttpEvent, HttpEventType, HttpHeaders, HttpParams, HttpProgressEvent} from '@angular/common/http';
import {catchError, filter, from, map, mergeMap, Observable, of, takeWhile, throwError} from 'rxjs';
import {Conversation} from '../models/conversation.model';
import {DocumentFile} from '../models/document-file.model';
import {GeneratedDocumentation} from '../models/generated-documentation.model';
import {AbstractService} from '../shared/abstract.service';
import {FileNode} from '../pages/conversation-detail/conversation-detail.component';

export interface GenerationStreamEvent {
    status: 'generating' | 'content' | 'complete' | 'error';
    progress?: number;
    chapter?: string;
    chunk?: string;
    documentation_id?: number;
    message?: string;
}

export interface ChatStreamEvent {
    status: 'content' | 'complete' | 'error';
    chunk?: string;
    message?: string;
}

export interface ChatHistory {
    id?: number;
    conversation_id: number;
    content: string;
}

export interface Muster {
    id?: number;
    name: string;
    content?: string;
    owner?: string;
    is_predefined: boolean;
}

export interface Model {
    name: string;
    hint?: string;
}

@Injectable({
    providedIn: 'root',
})
export class ApiService extends AbstractService {
    constructor(private http: HttpClient) {
        super();
    }

    // == Conversation Endpoints ==
    getConversations(): Observable<Conversation[]> {
        return this.http.get<Conversation[]>(this.getRelativeServiceURL('/conversation'));
    }

    getConversation(conversationId: number): Observable<Conversation> {
        return this.http.get<Conversation>(this.getRelativeServiceURL(`/conversation/${conversationId}`));
    }

    createConversation(name: string): Observable<Conversation> {
        const payload = {name};
        return this.http.post<Conversation>(this.getRelativeServiceURL(`/conversation`), payload);
    }

    deleteConversation(conversationId: number): Observable<void> {
        return this.http.delete<void>(this.getRelativeServiceURL(`/conversation/${conversationId}`));
    }

    // == File Endpoints ==
    getFiles(conversationId: number): Observable<DocumentFile[]> {
        return this.http.get<DocumentFile[]>(this.getRelativeServiceURL(`/conversation/${conversationId}/files`));
    }

    addFile(conversationId: number, path: string, content: string, fileType: string): Observable<any> {
        const payload = {
            path: path,
            content: content,
            // eslint-disable-next-line camelcase
            file_type: fileType,
        };
        return this.http.post(this.getRelativeServiceURL(`/conversation/${conversationId}/files`), payload);
    }

    editFile(updatedFile: DocumentFile): Observable<any> {
        // eslint-disable-next-line camelcase
        const payload = {updated_file: updatedFile};
        return this.http.put(
            this.getRelativeServiceURL(`/conversation/${updatedFile.conversation_id}/files/${updatedFile.id}`),
            payload
        );
    }

    deleteFile(conversationId: number, id: number, path: string, gitId: number): Observable<any> {
        return this.http.delete(this.getRelativeServiceURL(`/conversation/${conversationId}/files/${id}`), {
            // eslint-disable-next-line camelcase
            params: {path, git_id_or_null: gitId},
        });
    }

    deleteDirectory(conversationId: number, path: string, gitId: number): Observable<any> {
        return this.http.delete(this.getRelativeServiceURL(`/conversation/${conversationId}/directory`), {
            // eslint-disable-next-line camelcase
            params: {path, git_id_or_null: gitId},
        });
    }

    moveTree(conversationId: number, baseNode: FileNode, targetPath: string): Observable<any> {
        // Todo do warning for git files so it'd move the basepath of ALL git files

        return this.http.put(this.getRelativeServiceURL(`/conversation/${conversationId}/move_tree`), {
            node: baseNode,
            // eslint-disable-next-line camelcase
            target_path: targetPath,
        });
    }

    // == Repository Endpoints ==
    addRepository(conversationId: number, git: string, repoId: string): Observable<any> {
        return this.http.post(
            this.getRelativeServiceURL(`/conversation/${conversationId}/repository/${git}/${repoId}`),
            {}
        );
    }

    // == Documentation Endpoints ==
    getDocumentations(conversationId: number): Observable<GeneratedDocumentation[]> {
        return this.http.get<GeneratedDocumentation[]>(
            this.getRelativeServiceURL(`/conversation/${conversationId}/documentations`)
        );
    }

    generateDocumentationStream(
        conversationId: number,
        repoId: string,
        model: string,
        musterId?: number,
        musterName?: string
    ): Observable<GenerationStreamEvent> {
        const url = this.getRelativeServiceURL(`/conversation/${conversationId}/generate_documentation_stream`);

        let params = new HttpParams().set('model_name', model);

        if (repoId) {
            params = params.set('repo_id', repoId);
        }
        if (musterId) {
            params = params.set('muster_id', musterId);
        }
        if (musterName) {
            params = params.set('muster_name', musterName);
        }

        const request$ = this.http.get(url, {
            params,
            headers: new HttpHeaders({
                Accept: 'text/event-stream',
            }),
            reportProgress: true,
            observe: 'events',
            responseType: 'text',
        });

        return this._parseSseStream<GenerationStreamEvent>(request$);
    }

    updateDocumentation(updatedDocumentation: GeneratedDocumentation): Observable<GeneratedDocumentation> {
        return this.http.put<GeneratedDocumentation>(
            this.getRelativeServiceURL(
                `/conversation/${updatedDocumentation.conversation_id}/documentations/${updatedDocumentation.id}`
            ),
            updatedDocumentation
        );
    }

    deleteDocumentation(conversationId: number, documentationId: number): Observable<void> {
        return this.http.delete<void>(
            this.getRelativeServiceURL(`/conversation/${conversationId}/documentations/${documentationId}`)
        );
    }

    // == Chat Endpoints ==
    chatWithModel(conversationId: number, message: string, model: string): Observable<ChatStreamEvent> {
        const url = this.getRelativeServiceURL(`/conversation/${conversationId}/chat`);

        const body = {
            message: message,
            // eslint-disable-next-line camelcase
            model_name: model,
        };

        const request$ = this.http.post(url, body, {
            headers: new HttpHeaders({
                Accept: 'text/event-stream',
            }),
            reportProgress: true,
            observe: 'events',
            responseType: 'text',
        });

        return this._parseSseStream<ChatStreamEvent>(request$);
    }

    getChatHistory(conversationId: number): Observable<ChatHistory> {
        return this.http
            .get<ChatHistory>(this.getRelativeServiceURL(`/conversation/${conversationId}/chat_history`))
            .pipe(
                catchError(err => {
                    if (err.status === 404) {
                        // eslint-disable-next-line camelcase
                        return of({conversation_id: conversationId, content: ''});
                    }
                    return throwError(() => err);
                })
            );
    }

    // == Model Endpoints ==
    getModels(): Observable<Model[]> {
        return this.http.get<Model[]>(this.getRelativeServiceURL(`/model`));
    }

    // == Muster Endpoints ==
    getMuster(): Observable<Muster[]> {
        return this.http.get<Muster[]>(this.getRelativeServiceURL(`/muster`));
    }

    getMusterById(id: number): Observable<Muster> {
        return this.http.get<Muster>(this.getRelativeServiceURL(`/muster/${id}`));
    }

    getPredefinedMusterByName(name: string): Observable<Muster> {
        return this.http.get<Muster>(this.getRelativeServiceURL(`/muster/predefined/${name}`));
    }

    createMuster(name: string, content: string): Observable<Muster> {
        return this.http.post<Muster>(this.getRelativeServiceURL(`/muster`), {name, content});
    }

    updateMuster(id: number, muster: Muster): Observable<Muster> {
        return this.http.put<Muster>(this.getRelativeServiceURL(`/muster/${id}`), {
            name: muster.name,
            content: muster.content,
        });
    }

    deleteMuster(id: number): Observable<void> {
        return this.http.delete<void>(this.getRelativeServiceURL(`/muster/${id}`));
    }

    // == Helper Methods ==
    private _parseSseStream<T>(request$: Observable<HttpEvent<string>>): Observable<T> {
        let buffer = '';
        let lastSeenText = ''; // Use the full last text to get the new chunk

        return request$.pipe(
            // 1. Filter for DownloadProgress events.
            filter((event): event is HttpProgressEvent => event.type === HttpEventType.DownloadProgress),

            // 2. The event.partialText is cumulative. Extract only the new part of the text.
            // We must cast the event to `any` to access the untyped `partialText` property.
            map(event => {
                const partialText = (event as any).partialText as string | undefined;

                if (!partialText) {
                    return '';
                }

                const newText = partialText.substring(lastSeenText.length);
                lastSeenText = partialText;
                return newText;
            }),

            filter(chunk => chunk !== ''), // Filter out any empty chunks that might occur

            // 3. Process each new chunk to find and emit complete SSE messages
            mergeMap(chunk => {
                buffer += chunk;
                const messages = buffer.split('\n\n');

                // The last element might be an incomplete message, so we keep it in the buffer
                buffer = messages.pop() || '';

                // Emit each complete message as a separate item in the stream
                return from(messages);
            }),

            // 4. Filter out any empty messages or non-data lines
            filter(message => message.startsWith('data: ')),

            // 5. Parse the JSON data from the message
            map(message => {
                try {
                    const json = message.substring(6); // 'data: ' is 6 chars
                    return JSON.parse(json) as T;
                } catch (error) {
                    throw new Error(`Failed to parse SSE message: "${message}"`);
                }
            }),

            // 6. Automatically complete the stream when a 'complete' or 'error' status is received.
            takeWhile(event => (event as any).status !== 'complete' && (event as any).status !== 'error', true),

            // 7. Handle any errors from the HTTP request or parsing
            catchError(err => {
                // eslint-disable-next-line no-console
                console.error('Error during SSE stream processing:', err);
                return throwError(() => new Error('An error occurred while streaming data.'));
            })
        );
    }
}
