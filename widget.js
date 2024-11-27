class ProductSearchWidget {
    constructor(triggerInputId) {
        this.triggerInputId = triggerInputId;
        this.apiUrl = 'https://search-module-chi.vercel.app/api/search';
        this.suggestionsUrl = 'https://search-module-chi.vercel.app/api/suggestions';
        this.correctionUrl = 'https://search-module-chi.vercel.app/api/correct';

        this.initWidget();
    }

    initWidget() {
        // Добавление шрифта в документ
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        const triggerInput = document.getElementById(this.triggerInputId);

        if (!triggerInput) {
            console.error(`Trigger input с ID "${this.triggerInputId}" не найден.`);
            return;
        }

        // Основная структура виджета через шаблонные строки
        const widgetHtml = `
    <div class="widget-container" style="display: none;">
        <div class="widget-close-button">&times;</div>
        <div class="widget-input-wrapper">
            <div class="widget-search-icon"></div>
            <input type="text" class="widget-search-input" placeholder="Search products...">
        </div>
        <div class="widget-history-container">
            <div class="widget-history-title">Можливо ви шукаєте</div>
            <div class="widget-history-list"></div>
        </div>
        <div class="main-content-container">
            <div class="categories-container"></div> <!-- Левый контейнер -->
            <div class="widget-result-container"></div> <!-- Средний контейнер -->
            <div class="additional-info-container"></div> <!-- Правый контейнер -->
        </div>
    </div>
`;

        // Создание и добавление DOM-структуры
        const widgetContainerWrapper = document.createElement('div');
        widgetContainerWrapper.innerHTML = widgetHtml.trim();
        const widgetContainer = widgetContainerWrapper.firstElementChild;
        document.body.appendChild(widgetContainer);

        // Сохранение ссылок на элементы для дальнейшего использования
        const searchInput = widgetContainer.querySelector('.widget-search-input');
        const closeButton = widgetContainer.querySelector('.widget-close-button');
        const historyList = widgetContainer.querySelector('.widget-history-list');
        const categoriesContainer = widgetContainer.querySelector('.categories-container');
        const resultContainer = widgetContainer.querySelector('.widget-result-container');

        // Обработчик для закрытия виджета
        closeButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
        });

        // Обработчик для открытия виджета
        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            searchInput.focus();
        });

        // Обработчик ввода текста в поисковое поле
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            const lastChar = e.target.value.slice(-1);

            // Сохранение текущего запроса
            this.currentQuery = query;

            // Автокоррекция при вводе пробела
            if (lastChar === ' ') {
                const lastWord = query.split(' ').slice(-1)[0];
                if (lastWord) {
                    await this.correctQuery(lastWord, searchInput);
                }
            }

            // Проверка минимальной длины запроса
            if (query.length < 3) {
                resultContainer.innerHTML = '<p>Почніть пошук...</p>';
                categoriesContainer.innerHTML = '';
                historyList.innerHTML = '';
                return;
            }

            // Обновление истории и результатов поиска
            await this.fetchSuggestions(query, historyList, searchInput);
            await this.fetchProducts(query, categoriesContainer, resultContainer);
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

            // Проверяем, не изменился ли текст
            if (searchInput.value.trim() !== this.currentQuery) {
                console.log('Input text changed, skipping suggestions update.');
                return;
            }

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
        // Устанавливаем лоадер в resultContainer
        resultContainer.innerHTML = `
            <div class="loader">
                <div class="loader-circle"></div>
            </div>
        `;

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

            // Проверяем, не изменился ли текст
            if (this.currentQuery !== query) {
                console.log('Input text changed, skipping product update.');
                return;
            }

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
        console.log('Grouped Products:', groupedProducts); // Лог для проверки группировки
        console.log('Selected Category:', selectedCategory); // Лог для проверки выбранной категории

        // Проверяем, выбрана ли категория "Всі результати"
        const isAllResults = selectedCategory === null;

        // Устанавливаем количество товаров для отображения
        const maxItemsToShow = isAllResults ? 4 : 15;

        // Обновляем классы .widget-result-container
        if (isAllResults) {
            resultContainer.classList.add('all-results');
        } else {
            resultContainer.classList.remove('all-results');
        }

        resultContainer.innerHTML = '';

        Object.entries(groupedProducts).forEach(([category, items]) => {
            const isSingleCategory = Object.keys(groupedProducts).length === 1 && !selectedCategory;
            console.log(`Rendering category: ${category}, Items count: ${items.length}, isSingleCategory: ${isSingleCategory}`);

            const categoryTitleHtml = (showCategoryTitles || selectedCategory)
                ? `<h3>${category} →</h3>`
                : '';

            // HTML для первых maxItemsToShow товаров
            const initialProductItemsHtml = items
                .slice(0, maxItemsToShow)
                .map(item => `
                    <div class="product-item">
                        <img src="${item.imageUrl}" alt="${item.name}">
                        <div>
                            <p class="product-name">${item.name}</p>
                            <p class="product-price">${item.price.toFixed(2)} ${item.currencyId}</p>
                            <p class="product-presence">${item.presence}</p>
                        </div>
                    </div>
                `)
                .join('');

            // HTML для кнопки "ще"
            const moreLinkHtml = items.length > maxItemsToShow
                ? `<div class="more-link">ще ${items.length - maxItemsToShow} ...</div>`
                : '';

            // HTML блока категории
            const categoryBlockHtml = `
                <div class="category-block ${isSingleCategory ? 'category-single' : 'category-multiple'}">
                    ${categoryTitleHtml}
                    <div class="product-container">
                        ${initialProductItemsHtml}
                        ${moreLinkHtml}
                    </div>
                </div>
            `;

            const categoryBlock = document.createElement('div');
            categoryBlock.innerHTML = categoryBlockHtml.trim();

            // Обработка клика по "ще"
            if (items.length > maxItemsToShow) {
                const moreLink = categoryBlock.querySelector('.more-link');
                moreLink.addEventListener('click', () => {
                    const hiddenItemsHtml = items.slice(maxItemsToShow) // Оставшиеся товары
                        .map(item => `
                            <div class="product-item">
                                <img src="${item.imageUrl}" alt="${item.name}">
                                <div>
                                    <p class="product-name">${item.name}</p>
                                    <p class="product-price">${item.price.toFixed(2)} ${item.currencyId}</p>
                                    <p class="product-presence">${item.presence}</p>
                                </div>
                            </div>
                        `)
                        .join('');

                    // Вставляем оставшиеся товары перед кнопкой "ще"
                    moreLink.insertAdjacentHTML('beforebegin', hiddenItemsHtml);
                    moreLink.remove(); // Убираем кнопку "ще"
                });
            }

            resultContainer.appendChild(categoryBlock);
        });

        console.log('Final result container:', resultContainer.innerHTML);
    }





}

document.addEventListener('DOMContentLoaded', () => {
    const triggerInputId = 'searchInput';
    new ProductSearchWidget(triggerInputId);
});
