class ProductSearchWidget {
    constructor(triggerInputId) {
        this.triggerInputId = triggerInputId;
        this.apiUrl = 'https://search-module-chi.vercel.app/api/search';
        this.suggestionsUrl = 'https://search-module-chi.vercel.app/api/suggestions';
        this.correctionUrl = 'https://search-module-chi.vercel.app/api/correct';

        this.initWidget();
    }

    initWidget() {
        // Add the font dynamically to the document head
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

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

        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'widget-history-container';

        const historyTitle = document.createElement('div');
        historyTitle.className = 'widget-history-title';
        historyTitle.textContent = 'Можливо ви шукаєте';

        const historyList = document.createElement('div');
        historyList.className = 'widget-history-list';

        suggestionsContainer.appendChild(historyTitle);
        suggestionsContainer.appendChild(historyList);

        const categoriesContainer = document.createElement('div');
        categoriesContainer.className = 'categories-container';

        const resultContainer = document.createElement('div');
        resultContainer.className = 'widget-result-container';

        inputWrapper.appendChild(searchIcon);
        inputWrapper.appendChild(searchInput);
        widgetContainer.appendChild(closeButton);
        widgetContainer.appendChild(inputWrapper);
        widgetContainer.appendChild(suggestionsContainer);
        const mainContentContainer = document.createElement('div');
        mainContentContainer.className = 'main-content-container';

        mainContentContainer.appendChild(categoriesContainer);
        mainContentContainer.appendChild(resultContainer);

        widgetContainer.appendChild(mainContentContainer);
        document.body.appendChild(widgetContainer);

        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            searchInput.focus();
        });

        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            const lastChar = e.target.value.slice(-1);

            if (lastChar === ' ') {
                const lastWord = query.split(' ').slice(-1)[0];
                if (lastWord) {
                    await this.correctQuery(lastWord, searchInput);
                }
            }

            if (query.length < 3) {
                resultContainer.innerHTML = '<p>Type at least 3 characters...</p>';
                categoriesContainer.innerHTML = '';
                historyList.innerHTML = '';
                return;
            }

            // Update search history/suggestions
            this.fetchSuggestions(query, historyList, searchInput);

            this.fetchProducts(query, categoriesContainer, resultContainer);
        });
    }

    async correctQuery(word, searchInput) {
        try {
            const response = await fetch(this.correctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ word }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const correctionResponse = await response.json();

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
            }
        } catch (error) {
            console.error('Error correcting query:', error);
        }
    }

    async fetchSuggestions(query, historyList, searchInput) {
        try {
            const response = await fetch(this.suggestionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputWord: query }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const suggestionsResponse = await response.json();

            historyList.innerHTML = '';

            const suggestions = suggestionsResponse.suggestions;

            if (Array.isArray(suggestions) && suggestions.length > 0) {
                for (let i = 0; i < suggestions.length; i += 4) {
                    const suggestionRow = document.createElement('div');
                    suggestionRow.className = 'suggestion-row';

                    suggestions.slice(i, i + 4).forEach((word) => {
                        const wordElement = document.createElement('span');
                        wordElement.textContent = word;
                        wordElement.className = 'suggestion-word';

                        wordElement.addEventListener('click', () => {
                            searchInput.value = word;
                            searchInput.dispatchEvent(new Event('input'));
                        });

                        suggestionRow.appendChild(wordElement);
                    });

                    historyList.appendChild(suggestionRow);
                }
            } else {
                historyList.innerHTML = '<p>...</p>';
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            historyList.innerHTML = '<p>Error fetching suggestions.</p>';
        }
    }

    async fetchProducts(query, categoriesContainer, resultContainer) {
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

            if (products.length === 0) {
                resultContainer.innerHTML = '<p>No products found.</p>';
                categoriesContainer.innerHTML = '';
            } else {
                this.displayProductsByCategory(products, categoriesContainer, resultContainer);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            resultContainer.innerHTML = '<p>Error fetching products.</p>';
        }
    }

    displayProductsByCategory(products, categoriesContainer, resultContainer) {
        categoriesContainer.innerHTML = '';
        resultContainer.innerHTML = '';

        const categories = {};
        const categoryCounts = {};

        products.forEach((product) => {
            product.categories.forEach((category) => {
                if (!categories[category]) categories[category] = [];
                categories[category].push(product);

                if (!categoryCounts[category]) categoryCounts[category] = 0;
                categoryCounts[category]++;
            });
        });

        products.forEach((product) => {
            let minCount = Infinity;
            let primaryCategory = null;
            product.categories.forEach((category) => {
                if (categoryCounts[category] < minCount) {
                    minCount = categoryCounts[category];
                    primaryCategory = category;
                }
            });
            product.primaryCategory = primaryCategory;
        });

        const groupedProducts = {};
        products.forEach((product) => {
            const category = product.primaryCategory;
            if (!groupedProducts[category]) groupedProducts[category] = [];
            groupedProducts[category].push(product);
        });

        const allResultsCategoryName = 'Всі результати';
        const categoryNames = [allResultsCategoryName, ...Object.keys(categories)];

        categoryNames.forEach((categoryName) => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            const productCount =
                categoryName === allResultsCategoryName ? products.length : categories[categoryName].length;
            categoryItem.textContent = `${categoryName} (${productCount})`;
            categoryItem.addEventListener('click', () => {
                const categoryItems = categoriesContainer.getElementsByClassName('category-item');
                Array.from(categoryItems).forEach((item) => item.classList.remove('active'));
                categoryItem.classList.add('active');

                if (categoryName === allResultsCategoryName) {
                    this.showCategoryProducts(groupedProducts, resultContainer, true);
                } else {
                    const productsInCategory = categories[categoryName];
                    this.showCategoryProducts({ [categoryName]: productsInCategory }, resultContainer, true, categoryName);
                }
            });

            if (categoryName === allResultsCategoryName) {
                categoryItem.classList.add('active');
            }

            categoriesContainer.appendChild(categoryItem);
        });

        this.showCategoryProducts(groupedProducts, resultContainer, true);
    }

    showCategoryProducts(groupedProducts, resultContainer, showCategoryTitles = true, selectedCategory = null) {
        resultContainer.innerHTML = '';

        Object.entries(groupedProducts).forEach(([category, items]) => {
            const categoryBlock = document.createElement('div');
            categoryBlock.className = 'category-block';

            if (showCategoryTitles || selectedCategory) {
                const categoryTitle = document.createElement('h3');
                categoryTitle.textContent = `${category} →`;
                categoryBlock.appendChild(categoryTitle);
            }

            items.forEach((item, index) => {
                const productItem = document.createElement('div');
                productItem.className = 'product-item';
                productItem.innerHTML = `
                    <img src="${item.imageUrl}" alt="${item.name}">
                    <div>
                        <p class="product-name">${item.name}</p>
                        <p class="product-price">${item.price.toFixed(2)} ${item.currencyId}</p>
                        <p class="product-presence">${item.presence}</p>
                    </div>
                `;
                if (selectedCategory || index < 4) {
                    categoryBlock.appendChild(productItem);
                } else if (index === 4) {
                    const moreLink = document.createElement('div');
                    moreLink.className = 'more-link';
                    moreLink.textContent = `ще ${items.length - 4} ...`;
                    moreLink.addEventListener('click', () => {
                        items.slice(4).forEach((hiddenItem) => {
                            const hiddenProductItem = document.createElement('div');
                            hiddenProductItem.className = 'product-item';
                            hiddenProductItem.innerHTML = `
                                <img src="${hiddenItem.imageUrl}" alt="${hiddenItem.name}">
                                <div>
                                    <p class="product-name">${hiddenItem.name}</p>
                                    <p class="product-price">${hiddenItem.price.toFixed(2)} ${hiddenItem.currencyId}</p>
                                    <p class="product-presence">${hiddenItem.presence}</p>
                                </div>
                            `;
                            categoryBlock.appendChild(hiddenProductItem);
                        });
                        moreLink.remove();
                    });
                    categoryBlock.appendChild(moreLink);
                }
            });

            resultContainer.appendChild(categoryBlock);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const triggerInputId = 'searchInput';
    new ProductSearchWidget(triggerInputId);
});
