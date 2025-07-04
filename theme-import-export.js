// This module handles theme switching and data import/export functionality.

const themes = [
    // Light Themes
    { name: 'light', displayName: 'Claro', colors: ['#f3f4f6', '#4f46e5', '#16a34a'] },
    { name: 'mint', displayName: 'Menta', colors: ['#f0fdfa', '#0d9488', '#16a34a'] },
    { name: 'latte', displayName: 'Latte', colors: ['#fff', '#a47551', '#556b2f'] },
    { name: 'rose', displayName: 'Rosé', colors: ['#fff', '#e11d48', '#16a34a'] },
    // Dark Themes
    { name: 'dark', displayName: 'Oscuro', colors: ['#1f2937', '#4f46e5', '#4ade80'] },
    { name: 'midnight', displayName: 'Medianoche', colors: ['#161b22', '#58a6ff', '#56d364'] },
    { name: 'sunset', displayName: 'Atardecer', colors: ['#423254', '#ff9a8b', '#78e8c8'] },
    { name: 'dracula', displayName: 'Drácula', colors: ['#44475a', '#ff79c6', '#50fa7b'] }
];

const applyTheme = (themeName) => {
    const selectedTheme = themes.find(t => t.name === themeName) || themes[0];
    document.documentElement.setAttribute('data-theme', selectedTheme.name);
    localStorage.setItem('theme', selectedTheme.name);
    document.dispatchEvent(new CustomEvent('themechange'));
};

export const setupThemeSelector = (themeModal, themeContainer, themeSwitcherButtons) => {
    // 1. Populate the theme modal with theme options
    themeContainer.innerHTML = '';
    themes.forEach(theme => {
        const themeButton = document.createElement('button');
        themeButton.className = 'theme-option-button';
        themeButton.dataset.themeName = theme.name;
        themeButton.innerHTML = `
            <div class="theme-preview">
                <span style="background-color: ${theme.colors[0]}"></span>
                <span style="background-color: ${theme.colors[1]}"></span>
                <span style="background-color: ${theme.colors[2]}"></span>
            </div>
            <span class="theme-name">${theme.displayName}</span>
        `;
        themeButton.addEventListener('click', () => {
            applyTheme(theme.name);
            themeModal.close();
        });
        themeContainer.appendChild(themeButton);
    });

    // 2. Add event listeners to all buttons that should open the theme modal
    themeSwitcherButtons.forEach(button => {
        button.addEventListener('click', () => {
            themeModal.showModal();
        });
    });

    // 3. Set the initial theme from localStorage or default
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
};

export const setupDataImportExport = (exportBtn, importBtn, importFile, getCardsRef, getBudgetRef, onImportSuccess) => {
    exportBtn.addEventListener('click', () => {
        const cards = getCardsRef();
        const budget = getBudgetRef();
        const currentTheme = localStorage.getItem('theme') || 'light';

        const exportData = {
            version: 2, // Add a version number for future migrations
            theme: currentTheme,
            cards: cards,
            budget: budget,
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `credit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                // Check for new format { version, theme, cards, budget }
                if (importedData && importedData.cards && Array.isArray(importedData.cards) && importedData.theme) {
                     if(confirm('Esto reemplazará todos tus datos actuales (tarjetas, presupuesto y tema). ¿Estás seguro?')){
                        applyTheme(importedData.theme);
                        // The main script will handle updating state for cards and budget
                        onImportSuccess(importedData); 
                        alert('¡Datos importados con éxito!');
                    }
                } 
                // Check for old format (just an array of cards) for backward compatibility
                else if (Array.isArray(importedData)) {
                    if(confirm('Este es un archivo de respaldo antiguo. Esto reemplazará solo tus datos de tarjetas actuales. ¿Estás seguro?')){
                        // Pass a compliant object to the success handler
                        onImportSuccess({ cards: importedData, budget: null, theme: localStorage.getItem('theme') || 'light' });
                        alert('¡Datos de tarjetas importados con éxito!');
                    }
                }
                else {
                    throw new Error('Formato de archivo no válido.');
                }
            } catch (error) {
                alert('Error al importar el archivo. Asegúrate de que es un archivo de respaldo válido.');
                console.error("Import error:", error);
            }
        };
        reader.readAsText(file);
        importFile.value = ''; // Reset for next import
    });
};