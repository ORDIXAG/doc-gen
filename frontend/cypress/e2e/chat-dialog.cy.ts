describe('Chat Dialog E2E Tests', () => {
    const CONVERSATION_ID = 1;

    beforeEach(() => {
        // Mock any initial data loading for the conversation detail page if necessary
        cy.intercept('GET', '**/conversation', { fixture: 'conversations.json' }).as('getConversations');
        cy.intercept('GET', `**/conversation/${CONVERSATION_ID}`, { fixture: 'conversation.json' }).as('getConversation');
        cy.intercept('GET', `**/conversation/${CONVERSATION_ID}/files`, { body: [] }).as('getFiles');
        cy.intercept('GET', `**/conversation/${CONVERSATION_ID}/documentations`, { fixture: 'conversation-docs.json' }).as('getDocs');
        cy.intercept('GET', `**/model`, { fixture: 'models.json' }).as('getModels');
        cy.intercept('GET', `**/muster`, { fixture: 'muster.json' }).as('getMuster');
        
        cy.login('ma1', '/');

        cy.visit(`/#/conversation/${CONVERSATION_ID}`);
    });

    it('should open the dialog, load, and display previous chat history', () => {
        // Mock the initial history fetch
        const historyContent =
            '<dokumentationsgenerator-user>Previous question</dokumentationsgenerator-user>' +
            '<dokumentationsgenerator-assistant>Previous answer</dokumentationsgenerator-assistant>';
        cy.intercept('GET', `**/conversation/${CONVERSATION_ID}/chat_history`, {
            body: { conversation_id: CONVERSATION_ID, content: historyContent },
        }).as('getHistory');

        // --- Action ---
        cy.get('[data-cy=chat-btn]').click();

        // --- Assertions ---
        cy.wait('@getHistory');
        cy.get('mat-dialog-container').should('be.visible');

        cy.get('.chat-message.role-user').should('contain.text', 'Previous question');
        cy.get('.chat-message.role-assistant').should('contain.text', 'Previous answer');
    });

    it('should handle an empty chat history gracefully', () => {
        cy.intercept('GET', `**/conversation/${CONVERSATION_ID}/chat_history`, {
            body: { conversation_id: CONVERSATION_ID, content: '' },
        }).as('getEmptyHistory');

        // --- Action ---
        cy.get('[data-cy=chat-btn]').click();

        // --- Assertions ---
        cy.wait('@getEmptyHistory');
        cy.get('mat-dialog-container').should('be.visible');
        cy.get('.chat-message').should('not.exist');
    });

    // Mocking the streamed response didn't work since Cypress processed the entire stream
    // at once before the chat window can get even one chunk. To mock streamed responses in Cypress
    // is going to be very difficult, so test this at a later point.
});