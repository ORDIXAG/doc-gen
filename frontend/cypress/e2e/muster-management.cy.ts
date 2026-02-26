describe('Muster Management Page E2E Tests', () => {
    const predefinedMuster = {
        name: 'Predefined Muster',
        is_predefined: true,
    };
    const customMuster = {
        id: 1,
        name: 'My Custom Muster',
        content: '# My Template Content',
        owner: 'user',
        is_predefined: false,
    };

    beforeEach(() => {
        cy.login('ma1', '/');
        cy.intercept('GET', '**/muster', {
            body: [predefinedMuster, customMuster],
        }).as('getMusterList');
        
        cy.visit('/#/muster');
        cy.wait('@getMusterList');
    });

    it('should display predefined and custom musters correctly', () => {
        cy.contains('mat-list-item', 'Predefined Muster').as('predefinedItem');
        cy.get('@predefinedItem').should('contain.text', 'Predefined');
        cy.get('@predefinedItem').find('button[mat-icon-button]').should('not.exist');

        cy.contains('mat-list-item', 'My Custom Muster').as('customItem');
        cy.get('@customItem').should('contain.text', 'Custom');
        cy.get('@customItem').find('button[mat-icon-button]').should('be.visible');
    });

    it('should allow creating a new muster', () => {
        cy.intercept('POST', '**/muster', {
            statusCode: 200,
            body: { id: 2, name: 'Newly Created', content: 'New content', is_predefined: false },
        }).as('postMuster');
        
        cy.get('[data-cy=create-muster-btn]').click();
        
        cy.get('.editor-card').should('contain.text', 'Muster Erstellen');
        
        cy.get('.editor-card input[matinput]').type('Newly Created');
        cy.get('.editor-card textarea[matinput]').type('New content');
        
        cy.get('.editor-card button').contains('Speichern').click();
        
        cy.wait('@postMuster').its('request.body').should('deep.equal', {
            name: 'Newly Created',
            content: 'New content',
        });
        
        cy.get('mat-snack-bar-container').should('contain.text', 'Muster erfolgreich gespeichert');
    });
    
    it('should load a custom muster for editing', () => {
        // Intercept the GET by ID which is called on selection
        cy.intercept('GET', `**/muster/${customMuster.id}`, {
            body: customMuster
        }).as('getMusterById');

        cy.contains('mat-list-item', customMuster.name).click();
        
        cy.wait('@getMusterById');
        
        cy.get('.editor-card').should('contain.text', 'Muster Verändern');
        cy.get('.editor-card input[matinput]').should('have.value', customMuster.name);
        cy.get('.editor-card textarea[matinput]').should('have.value', customMuster.content);
    });

    it('should save changes to an existing muster', () => {
        cy.intercept('GET', `**/muster/${customMuster.id}`, { body: customMuster }).as('getMusterById');
        cy.intercept('PUT', `**/muster/${customMuster.id}`, { statusCode: 200 }).as('putMuster');

        cy.contains('mat-list-item', customMuster.name).click();
        cy.wait('@getMusterById');
        
        cy.get('.editor-card input[matinput]').clear().type('Updated Name');
        cy.get('.editor-card button').contains('Speichern').click();
        
        cy.wait('@putMuster').its('request.body').should('deep.equal', {
            name: 'Updated Name',
            content: customMuster.content,
        });
    });

    it('should allow deleting a custom muster', () => {
        cy.intercept('DELETE', `**/muster/${customMuster.id}`, { statusCode: 204 }).as('deleteMuster');
        // Stub window.confirm to always return true
        cy.on('window:confirm', () => true);

        cy.contains('mat-list-item', customMuster.name)
            .find('button[mat-icon-button]')
            .click();
            
        cy.wait('@deleteMuster');
        cy.get('mat-snack-bar-container').should('contain.text', 'Muster gelöscht');
    });

    it('should prevent editing of predefined musters', () => {
        cy.contains('mat-list-item', predefinedMuster.name).click();
        
        cy.get('.editor-card').should('be.visible');
        cy.get('.editor-card input[matinput]').should('be.disabled');
        cy.get('.editor-card').should('contain.text', 'Muster ist vorgefertigt und kann nicht verändert werden');
    });
});