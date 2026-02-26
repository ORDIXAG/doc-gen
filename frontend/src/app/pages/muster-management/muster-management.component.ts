import {Component, OnInit} from '@angular/core';
import {ApiService, Muster} from 'src/app/services/api.service';
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
    selector: 'dokumentationsgenerator-muster-management',
    templateUrl: './muster-management.component.html',
    styleUrls: ['./muster-management.component.scss'],
    standalone: false,
})
export class MusterManagementComponent implements OnInit {
    musterList: Muster[] = [];
    selectedMuster: Muster | null = null;

    // State for the editor panel
    editorMuster: Partial<Muster> = {};
    isCreating = false;
    isLoading = false;
    isDisabled = false;

    readonly helpText = `Automatische Ersetzungen:
• {{Datum}} wird durch das aktuelle Datum ersetzt.
• {{Name des Entwicklers/Teams}} wird durch Ihren Namen/Kürzel ersetzt.

Fortschrittsmarker:
• <!--PROGRESS:Kapitel n: Kapitelname--> erlaubt es den Fortschritt während einer Dokumentation zu markieren.`;

    constructor(
        private api: ApiService,
        private snackBar: MatSnackBar
    ) {}

    ngOnInit(): void {
        this.loadMusterList();
    }

    loadMusterList(): void {
        this.isLoading = true;
        this.api.getMuster().subscribe(data => {
            this.musterList = data.sort((a, b) => a.name.localeCompare(b.name));
            this.isLoading = false;
        });
    }

    selectMuster(muster: Muster): void {
        this.isCreating = false;
        this.selectedMuster = muster;

        if (muster.is_predefined) {
            // Predefined muster can't be edited.
            this.isDisabled = true;
            this.api.getPredefinedMusterByName(muster.name).subscribe(fullMuster => {
                this.editorMuster = {...fullMuster};
            });
        } else {
            this.isDisabled = false;
            this.api.getMusterById(muster.id!).subscribe(fullMuster => {
                this.editorMuster = {...fullMuster};
            });
        }
    }

    startNewMuster(): void {
        this.selectedMuster = null;
        this.isCreating = true;
        this.isDisabled = false;
        this.editorMuster = {name: '', content: ''};
    }

    saveMuster(): void {
        if (!this.editorMuster.name || !this.editorMuster.content) {
            this.snackBar.open('Name und Inhalt sind erforderlich.', 'Close', {duration: 3000});
            return;
        }

        this.isLoading = true;
        const apiCall = this.isCreating
            ? this.api.createMuster(this.editorMuster.name, this.editorMuster.content)
            : this.api.updateMuster(this.selectedMuster!.id!, this.editorMuster as Muster);

        apiCall.subscribe({
            next: () => {
                this.snackBar.open('Muster erfolgreich gespeichert!', 'Close', {duration: 3000});
                this.loadMusterList();
                this.cancel();
            },
            error: err => {
                this.isLoading = false;
                const message = err.status === 409 ? err.error.detail : 'Muster konnte nicht gespeichert werden.';
                this.snackBar.open(message, 'Close', {duration: 5000});
            },
        });
    }

    deleteMuster(muster: Muster): void {
        if (confirm(`Willst du wirklich das Muster "${muster.name}" löschen?`)) {
            this.isLoading = true;
            this.api.deleteMuster(muster.id!).subscribe(() => {
                this.snackBar.open('Muster gelöscht.', 'Close', {duration: 3000});
                this.loadMusterList();
                this.cancel();
            });
        }
    }

    cancel(): void {
        this.selectedMuster = null;
        this.isCreating = false;
        this.isDisabled = false;
        this.editorMuster = {};
    }
}
