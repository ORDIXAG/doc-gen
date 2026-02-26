import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {ApiService} from '../../services/api.service';
import {Conversation} from '../../models/conversation.model';

@Component({
    selector: 'dokumentationsgenerator-conversations-list',
    templateUrl: './conversations-list.component.html',
    styleUrls: ['./conversations-list.component.scss'],
    standalone: false,
})
export class ConversationsListComponent implements OnInit {
    allConversations: Conversation[] = [];
    filteredConversations: Conversation[] = [];
    searchTerm: string = '';
    isLoading = true;

    constructor(
        private api: ApiService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.loadConversations();
    }

    loadConversations(): void {
        this.isLoading = true;
        this.api.getConversations().subscribe({
            next: data => {
                this.allConversations = data.sort(
                    (a, b) => new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime()
                );
                this.filterConversations();
                this.isLoading = false;
            },
            error: err => {
                // eslint-disable-next-line no-console
                console.error('Failed to load conversations', err);
                alert('Fehler beim Laden der Konversationen.');
                this.isLoading = false;
            },
        });
    }

    filterConversations(): void {
        if (!this.searchTerm) {
            this.filteredConversations = this.allConversations;
        } else {
            this.filteredConversations = this.allConversations.filter(convo =>
                convo.name.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        }
    }

    createNewConversation(): void {
        const newName = prompt('Name für die neue Konversation:', 'Neue Dokumentation');
        if (newName) {
            this.api.createConversation(newName).subscribe({
                next: newConvo => {
                    this.router.navigate(['/conversation', newConvo.id]);
                },
                error: err => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to create conversation', err);
                    alert('Fehler beim Erstellen der Konversation.');
                },
            });
        }
    }

    deleteConversation(convo: Conversation): void {
        if (confirm(`Willst du wirklich die Konversation "${convo.name}" löschen?`)) {
            this.api.deleteConversation(convo.id).subscribe({
                next: () => {
                    this.loadConversations();
                },
                error: err => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to delete conversation', err);
                    alert('Fehler beim Löschen der Konversation.');
                },
            });
        }
    }
}
