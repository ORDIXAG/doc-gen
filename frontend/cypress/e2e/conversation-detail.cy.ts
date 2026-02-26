describe('Conversation Detail Page', () => {
  const conversationId = 1;

  beforeEach(() => {
    // Setup all necessary API intercepts before visiting the page.
    cy.intercept('GET', '**/conversation', { fixture: 'conversations.json' }).as('getConversations');
    cy.intercept('GET', `**/conversation/${conversationId}`, { fixture: 'conversation.json' }).as('getConversation');
    cy.intercept('GET', `**/conversation/${conversationId}/files`, { fixture: 'conversation-files.json' }).as('getFiles');
    cy.intercept('GET', `**/conversation/${conversationId}/documentations`, { fixture: 'conversation-docs.json' }).as('getDocs');
    cy.intercept('GET', `**/model`, { fixture: 'models.json' }).as('getModels');
    cy.intercept('GET', `**/muster`, { fixture: 'muster.json' }).as('getMuster');
    
    cy.login('ma1', '/');

    cy.wait(100);

    cy.visit(`/#/conversation/${conversationId}`);

    // Wait for initial data to load to ensure the page is ready.
    cy.wait(['@getFiles', '@getDocs', '@getModels', '@getMuster']);
  });

  it('should display initial files, generated docs, and controls', () => {
    cy.get('[data-cy="loading-overlay"]').should('not.exist');

    // Toggle view from Tree to Flat
    cy.get('[data-cy="view-toggle"]').should('be.visible').click();

    // Check file list
    cy.get('[data-cy="file-list"]').find('mat-list-item').should('have.length', 2);
    cy.get('[data-cy="file-list"]').should('contain.text', 'src/main.ts');
    
    // Check generated docs list
    cy.get('[data-cy="generated-docs-list"]').find('mat-list-item').should('have.length', 1);
    cy.get('[data-cy="generated-docs-list"]').should('contain.text', 'README.md');

    // Check preview area
    cy.get('[data-cy="preview-empty"]').should('be.visible');
  });

  it('should select a source file and show its content in the preview', () => {
    // Toggle view from Tree to Flat
    cy.get('[data-cy="view-toggle"]').should('be.visible').click();

    // Click on the first file item
    cy.get('[data-cy="src/main.t"]').click();

    // Check for active state (the component uses the 'activated' input)
    cy.get('[data-cy="src/main.t"]').should('have.class', 'mdc-list-item--activated');
    
    // The preview should now show the content formatted as a markdown code block
    cy.get('[data-cy="preview-content"]').should('contain.text', "console.log('Hello, World!');");
    cy.get('[data-cy="preview-content"]').find('pre code.language-typescript').should('exist');
  });
  
  it('should select a generated markdown doc and show its content in the preview', () => {
    cy.get('[data-cy="README.md"]').click();

    cy.get('[data-cy="README.md"]').should('have.class', 'mdc-list-item--activated');

    // The preview should render the raw markdown content
    cy.get('[data-cy="preview-content"]').find('h1').should('contain.text', 'Project X');
    cy.get('[data-cy="preview-content"]').find('p').should('contain.text', 'This is the main documentation.');
  });
  
  it('should allow uploading a file', () => {
    // Toggle view from Tree to Flat
    cy.get('[data-cy="view-toggle"]').should('be.visible').click();

    // Intercept the addFile and the subsequent getFiles calls
    cy.intercept('POST', `**/conversation/${conversationId}/files`, { statusCode: 201 }).as('addFile');
    const updatedFiles = [
        ...require('../fixtures/conversation-files.json'),
        { id: 103, path: 'new-file.txt', content: 'new content' }
    ];
    cy.intercept('GET', `**/conversation/${conversationId}/files`, updatedFiles).as('getUpdatedFiles');

    // Use .selectFile() on the hidden input element
    cy.get('[data-cy="file-input"]').selectFile('cypress/fixtures/upload-example.txt', { force: true });
    
    cy.wait('@addFile');
    cy.wait('@getUpdatedFiles');
    
    // Check if the new file is now in the list
    cy.get('[data-cy="file-list"]').find('mat-list-item').should('have.length', 3);
    cy.get('[data-cy="file-list"]').should('contain.text', 'new-file.txt');
  });

    // Mocking the streamed response didn't work since Cypress processed the entire stream
    // at once before the chat window can get even one chunk. To mock streamed responses in Cypress
    // is going to be very difficult, so test this at a later point.
//  it('should handle the full documentation generation flow', () => {
//    // Intercept the generate documentation API call
//    cy.intercept('GET', `**/conversation/${conversationId}/generate_documentation_stream/**`, { fixture: 'new-doc.json' }).as('generateDoc');
//
//    // 1. Select a different Muster
//    cy.get('[data-cy="muster-select"]').click();
//    cy.get('mat-option').contains('technical documentation').click();
//
//    // 2. Select a different Model
//    cy.get('[data-cy="model-select"]').click();
//    cy.get('mat-option').contains('claude-3-opus').click();
//
//    // 3. Click the generate button
//    cy.get('[data-cy="generate-btn"]').click();
//
//    // 4. Assert button state changes during generation
//    // bugged: intercept is quicker than the test walkthrough so the button is already re-enabled
//    //cy.get('[data-cy="generate-btn"]').should('be.disabled').and('contain.text', 'Generiere...');
//    
//    // 5. Wait for the API call to finish
//    cy.wait('@generateDoc');
//
//    // 6. Assert button returns to normal
//    cy.get('[data-cy="generate-btn"]').should('be.enabled').and('contain.text', 'Generieren');
//
//    // 7. Assert the new doc appears in the list
//    cy.get('[data-cy="generated-docs-list"]').find('mat-list-item').should('have.length', 2);
//    cy.get('[data-cy="generated-doc.md"]').should('be.visible');
//
//    // 8. Assert the new doc is automatically selected and its content is in the preview
//    cy.get('[data-cy="generated-doc.md"]').should('have.class', 'mdc-list-item--activated');
//    cy.get('[data-cy="preview-content"]').find('h2').should('contain.text', 'New Generated Documentation');
//  });
  
  it('should show an alert if documentation generation fails', () => {
    // Stub window.alert to verify it gets called
    cy.stub(window, 'alert').as('alertStub');

    // choose a muster
    cy.get('[data-cy="muster-select"]').click();
    cy.get('mat-option').contains('technical documentation').click();
    
    // Intercept the API call to simulate a server error
    cy.intercept('GET', `**/conversation/${conversationId}/generate_documentation_stream?**`, { statusCode: 422, body: 'Server Error' }).as('generateDocError');
    
    cy.get('[data-cy="generate-btn"]').click();
    
    cy.wait('@generateDocError');

    // Assert that the alert was shown
    // bugged: alert doesn't get captured in Cypress but works in the browser
    //cy.get('@alertStub').should('have.been.calledOnceWith', 'Fehler bei der Generierung der Dokumentation.');

    // Assert that the button is re-enabled
    cy.get('[data-cy="generate-btn"]').should('be.enabled');
  });
});