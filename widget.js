class ProductSearchWidget {
    constructor(triggerInputId) {
        this.triggerInputId = triggerInputId;
        this.apiUrl = 'https://search-module-chi.vercel.app/api/search';
        this.suggestionsUrl = 'https://search-module-chi.vercel.app/api/suggestions';
        this.correctionUrl = 'https://search-module-chi.vercel.app/api/correct'; // Новый роут для исправлений

        this.initWidget();
    }

    initWidget() {
        const triggerInput = document.getElementById(this.triggerInputId);

        if (!triggerInput) {
            console.error(`Trigger input with ID "${this.triggerInputId}" not found.`);
            return;
        }

        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'widget-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'widget-input-wrapper';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'widget-search-input';
        searchInput.placeholder = 'Search products...';

        const searchIcon = document.createElement('div');
        searchIcon.className = 'widget-search-icon';

        const closeButton = document.createElement('div');
        closeButton.innerHTML = '&times;';
        closeButton.className = 'widget-close-button';
        closeButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
        });

        const historyContainer = document.createElement('div');
        historyContainer.className = 'widget-history-container';

        const historyTitle = document.createElement('div');
        historyTitle.className = 'widget-history-title';
        historyTitle.textContent = 'Можливо ви шукаєте';

        const historyList = document.createElement('div');
        historyList.className = 'widget-history-list';

        historyContainer.appendChild(historyTitle);
        historyContainer.appendChild(historyList);

        const resultContainer = document.createElement('div');
        resultContainer.className = 'widget-result-container';

        inputWrapper.appendChild(searchIcon);
        inputWrapper.appendChild(searchInput);
        widgetContainer.appendChild(closeButton);
        widgetContainer.appendChild(inputWrapper);
        widgetContainer.appendChild(historyContainer);
        widgetContainer.appendChild(resultContainer);
        document.body.appendChild(widgetContainer);

        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            searchInput.focus();
        });

        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            const lastChar = e.target.value.slice(-1); // Получаем последний символ

            if (lastChar === ' ') {
                const lastWord = query.split(' ').slice(-1)[0]; // Получаем последнее слово
                if (lastWord) {
                    await this.correctQuery(lastWord, searchInput); // Исправляем последнее слово
                }
            }

            if (query.length < 3) {
                resultContainer.innerHTML = '<p>Type at least 3 characters...</p>';
                return;
            }

            // Обновить историю поиска
            this.fetchSuggestions(query, historyList);

            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ word: query }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const products = await response.json();

                resultContainer.innerHTML = '';

                if (products.length === 0) {
                    resultContainer.innerHTML = '<p>No products found.</p>';
                } else {
                    products.forEach((product) => {
                        const productElement = document.createElement('div');
                        productElement.className = 'widget-result-item';

                        productElement.innerHTML = `
                            <img src="${product.imageUrl}" alt="${product.name}">
                            <div class="father-block">
                                <div class="product-name">${product.name}</div>
                                <div class="product-price">${product.price.toFixed(2)} ${product.currencyId}</div>
                                <div class="product-presence">${product.presence}</div>
                            </div>
                        `;

                        resultContainer.appendChild(productElement);
                    });
                }
            } catch (error) {
                console.error('Error fetching products:', error);
                resultContainer.innerHTML = '<p>Error fetching products.</p>';
            }
        });
    }

    async correctQuery(word, searchInput) {
        try {
            console.log(`Correcting word: ${word}`);

            const response = await fetch(this.correctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ word }),
            });

            console.log(`Correction response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const correctionResponse = await response.json();
            console.log('Correction returned by API:', correctionResponse);

            if (
                correctionResponse &&
                correctionResponse.incorrectWord &&
                correctionResponse.correctWord
            ) {
                const correctedQuery = searchInput.value
                    .trim()
                    .split(' ')
                    .map((w) =>
                        w.toLowerCase() === correctionResponse.incorrectWord.toLowerCase()
                            ? correctionResponse.correctWord
                            : w
                    )
                    .join(' ');

                searchInput.value = correctedQuery;
                console.log(`Query corrected to: ${correctedQuery}`);
            }
        } catch (error) {
            console.error('Error correcting query:', error);
        }
    }

    async fetchSuggestions(query, historyList) {
        try {
            console.log(`Fetching suggestions for query: ${query}`);

            const response = await fetch(this.suggestionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputWord: query }),
            });

            console.log(`Response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const suggestionsResponse = await response.json();
            console.log('Suggestions returned by API:', suggestionsResponse);

            historyList.innerHTML = '';

            const suggestions = suggestionsResponse.suggestions;

            if (Array.isArray(suggestions) && suggestions.length > 0) {
                console.log('Suggestions are valid array:', suggestions);

                for (let i = 0; i < suggestions.length; i += 4) {
                    const suggestionRow = suggestions.slice(i, i + 4);
                    const suggestionRowElement = document.createElement('div');
                    suggestionRowElement.className = 'widget-history-item';

                    suggestionRow.forEach((word) => {
                        const wordElement = document.createElement('span');
                        wordElement.textContent = word;
                        wordElement.style.cursor = 'pointer';
                        wordElement.style.marginRight = '10px';

                        wordElement.addEventListener('click', () => {
                            searchInput.value = word;
                            searchInput.dispatchEvent(new Event('input'));
                        });

                        suggestionRowElement.appendChild(wordElement);
                    });

                    historyList.appendChild(suggestionRowElement);
                }
            } else {
                console.log('Suggestions are empty or not an array');
                historyList.innerHTML = '<p>...</p>';
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            historyList.innerHTML = '<p>Error fetching suggestions.</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const triggerInputId = 'searchInput';
    new ProductSearchWidget(triggerInputId);
});
