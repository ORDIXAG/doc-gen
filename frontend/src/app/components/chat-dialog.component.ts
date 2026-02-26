import {Component, Inject, OnDestroy, ViewChild, ElementRef, NgZone, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Subscription} from 'rxjs';
import {ApiService, ChatStreamEvent, Model} from 'src/app/services/api.service';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

@Component({
    selector: 'dokumentationsgenerator-chat-dialog',
    templateUrl: './chat-dialog.component.html',
    styleUrls: ['./chat-dialog.component.scss'],
    standalone: false,
})
export class ChatDialogComponent implements OnDestroy, OnInit {
    @ViewChild('chatHistoryContainer') private chatHistoryContainer!: ElementRef;

    messages: ChatMessage[] = [];
    newMessage = '';
    isLoading = false;
    private chatSubscription: Subscription | null = null;

    helpText = `Chatte mit dem Modell, wie ChatGPT.
Alle Dokumente sind dem Modell bereitgestellt.`;

    public get isSendDisabled(): boolean {
        return this.isLoading || !this.newMessage || this.newMessage.trim().length === 0;
    }

    constructor(
        public dialogRef: MatDialogRef<ChatDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: {conversationId: number; model: Model},
        private api: ApiService,
        private zone: NgZone,
        private snackBar: MatSnackBar
    ) {}

    ngOnInit(): void {
        this.isLoading = true;
        this.api.getChatHistory(this.data.conversationId).subscribe({
            next: history => {
                this.messages = this.parseHistoryContent(history.content);
                this.isLoading = false;
                // Defer scroll to ensure view is rendered
                setTimeout(() => this.scrollToBottom(), 0);
            },
            error: err => {
                // eslint-disable-next-line no-console
                console.error('Failed to load chat history', err);
                this.snackBar.open('Fehler beim Laden der Chat-Historie: ' + err.error.detail, 'Close', {
                    duration: 5000,
                });
                this.messages = [{role: 'assistant', content: 'Error: Could not load chat history.'}];
                this.isLoading = false;
            },
        });
    }

    sendMessage(): void {
        if (this.isSendDisabled) {
            return;
        }

        const userMessage = this.newMessage.trim();
        if (!userMessage || this.isLoading) {
            return;
        }

        this.messages.push({role: 'user', content: userMessage});
        this.newMessage = '';
        this.isLoading = true;

        // Prepare a placeholder for the assistant's response
        this.messages.push({role: 'assistant', content: ''});

        this.chatSubscription = this.api
            .chatWithModel(this.data.conversationId, userMessage, this.data.model.name)
            .subscribe({
                next: (event: ChatStreamEvent) => {
                    this.zone.run(() => {
                        if (event.status === 'content' && event.chunk) {
                            // Append chunk to the last (assistant) message
                            this.messages[this.messages.length - 1].content += event.chunk
                                .replace(/\\n/g, '\n')
                                .replace(/\\t/g, '\t');

                            this.scrollToBottom();
                        }
                    });
                },
                error: err => {
                    this.zone.run(() => {
                        // eslint-disable-next-line no-console
                        console.error('Chat stream failed:', err);
                        this.snackBar.open('Chat stream failed: ' + err.error.detail, 'Close', {duration: 5000});
                        this.messages[this.messages.length - 1].content =
                            '**Error:** Could not get response from server.';
                        this.isLoading = false;
                    });
                },
                complete: () => {
                    this.zone.run(() => {
                        this.isLoading = false;
                        this.scrollToBottom();
                    });
                },
            });
    }

    private parseHistoryContent(content: string): ChatMessage[] {
        if (!content) {
            return [];
        }

        const messages: ChatMessage[] = [];
        const userToken = /<dokumentationsgenerator-user>([\s\S]*?)<\/dokumentationsgenerator-user>/g;
        const assistantToken = /<dokumentationsgenerator-assistant>([\s\S]*?)<\/dokumentationsgenerator-assistant>/g;

        // Create arrays of matches with their indices
        const userMatches = Array.from(content.matchAll(userToken)).map(m => ({
            type: 'user',
            content: m[1],
            index: m.index,
        }));
        const assistantMatches = Array.from(content.matchAll(assistantToken)).map(m => ({
            type: 'assistant',
            content: m[1],
            index: m.index,
        }));

        // Combine and sort by index to preserve order
        const allMatches = [...userMatches, ...assistantMatches].sort((a, b) => a.index! - b.index!);

        for (const match of allMatches) {
            messages.push({role: match.type as 'user' | 'assistant', content: match.content});
        }

        return messages;
    }

    private scrollToBottom(): void {
        try {
            this.chatHistoryContainer.nativeElement.scrollTop = this.chatHistoryContainer.nativeElement.scrollHeight;
        } catch (err) {
            /* NOP */
        }
    }

    ngOnDestroy(): void {
        this.chatSubscription?.unsubscribe();
    }
}
