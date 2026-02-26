describe('Conversations List Page', () => {
  beforeEach(() => {
    // Intercept the API call for conversations and return mock data from a fixture.
    cy.intercept('GET', '**/conversation', { fixture: 'conversations.json' }).as('getConversations');
    
    cy.login('ma1', '/');

    cy.wait(100);

    cy.visit('/#/');
  });

  it('should display a loading spinner and then the list of conversations', () => {
    // Wait for the intercepted request to complete.
    cy.wait('@getConversations');

    // After loading, the spinner should not exist.
    cy.get('[data-cy="loading-spinner"]').should('not.exist');
    
    // The list should now be populated with our two mock conversations.
    cy.get('[data-cy="conversations-list"]').find('mat-list-item').should('have.length', 2);
    cy.get('[data-cy="1"]').should('contain.text', 'Technical Documentation for Project X');
    cy.get('[data-cy="2"]').should('contain.text', 'API Reference for User Service');
  });

  it('should filter the list based on the search term', () => {
    cy.wait('@getConversations');
    
    // Type into the search input.
    cy.get('[data-cy="search-input"]').type('API');
    
    // Assert that only one item is now visible.
    cy.get('[data-cy="conversations-list"]').find('mat-list-item').should('have.length', 1);
    cy.get('[data-cy="2"]').should('be.visible');
    cy.get('[data-cy="1"]').should('not.exist');

    // Clear the search input.
    cy.get('[data-cy="search-input"]').clear();
    
    // Assert that both items are visible again.
    cy.get('[data-cy="conversations-list"]').find('mat-list-item').should('have.length', 2);
  });

  it('should display an empty state when no conversations are found', () => {
    // Override the intercept for this specific test to return an empty array.
    cy.intercept('GET', '**/conversation', []).as('getEmptyConversations');
    cy.reload();
    cy.wait('@getEmptyConversations');
    
    cy.get('[data-cy="empty-state"]').should('be.visible').and('contain.text', 'Keine Konversationen gefunden.');
    cy.get('[data-cy="conversations-list"]').find('mat-list-item').should('not.exist');
  });

  it('should navigate to the detail page when a conversation is clicked', () => {
    cy.intercept('GET', `**/conversation/1/files`, { fixture: 'conversation-files.json' }).as('getFiles');
    cy.intercept('GET', `**/conversation/1/documentations`, { fixture: 'conversation-docs.json' }).as('getDocs');
    cy.intercept('GET', `**/model`, { fixture: 'models.json' }).as('getModels');

    cy.wait('@getConversations');
    cy.get('[data-cy="1"]').click();
    
    // Assert that the URL has changed to the correct detail page.
    cy.url().should('include', '/conversation/1');
  });

  it('should open a prompt, create a new conversation, and navigate', () => {
    const newConversationName = 'My New Documentation';
    const newConversationResponse = { id: 3, name: newConversationName };

    // Intercept the POST request to create the conversation.
    cy.intercept('POST', '**/conversation', newConversationResponse).as('createConversation');
    cy.intercept('GET', `**/conversation/3/files`, { fixture: 'conversation-files.json' }).as('getFiles');
    cy.intercept('GET', `**/conversation/3/documentations`, { fixture: 'conversation-docs.json' }).as('getDocs');
    cy.intercept('GET', `**/model`, { fixture: 'models.json' }).as('getModels');

    // Stub the window.prompt to control its behavior in the test.
    cy.window().then((win) => {
      cy.stub(win, 'prompt').returns(newConversationName);
    });

    cy.wait('@getConversations');
    cy.get('[data-cy="create-conversation-btn"]').click();

    // Verify the POST request was made with the correct data.
    cy.wait('@createConversation').its('request.body').should('deep.equal', {
      name: newConversationName
    });

    // After creation, it should navigate to the new conversation's page.
    cy.url().should('include', '/conversation/3');
  });
});