export interface DocumentFile {
    id: number;
    conversation_id: number;
    path: string;
    content: string;
    file_type: string;
    git_id: number;
}
