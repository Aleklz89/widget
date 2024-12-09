class ProductSearchWidget {
    constructor(triggerInputId) {
        this.triggerInputId = triggerInputId;
        this.apiUrl = 'https://search-module-chi.vercel.app/api/search';
        this.suggestionsUrl = 'https://search-module-chi.vercel.app/api/search-suggestions';
        this.correctionUrl = 'https://search-module-chi.vercel.app/api/correct';
        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.requestId = 0; // Добавляем счётчик запросов
        this.initWidget();
    }



    showHistory() {
        const historyList = document.querySelector('.widget-history-list');
        if (historyList) {
            historyList.classList.add('show');
        }
    }

    hideHistory() {
        const historyList = document.querySelector('.widget-history-list');
        if (historyList) {
            historyList.classList.remove('show');
        }
    }

    async loadJsCookieLibrary() {
        if (window.Cookies) return; // Если библиотека уже загружена, ничего не делаем

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js';
            script.type = 'text/javascript';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load js-cookie library'));
            document.head.appendChild(script);
        });
    }

    async getOrCreateUserId() {
        if (!window.Cookies) {
            await this.loadJsCookieLibrary();
        }

        let userId = Cookies.get('userId');
        if (!userId) {
            // Генерация случайного числа с фиксированным количеством цифр
            userId = Math.floor(Math.random() * 1e9).toString(); // Генерирует число от 0 до 999999999
            Cookies.set('userId', userId, { expires: 365 });
        }
        this.userId = userId;
    }

    async initWidget() {
        console.log('Widget initialization started.');

        // Подключение HTML
        const response = await fetch('https://aleklz89.github.io/widget/widget.html'); // Убедитесь, что путь к widget.html корректен
        const widgetHtml = await response.text();

        const widgetContainerWrapper = document.createElement('div');
        widgetContainerWrapper.innerHTML = widgetHtml.trim();
        const widgetContainer = widgetContainerWrapper.firstElementChild;
        console.log('Widget container created:', widgetContainer);
        document.body.appendChild(widgetContainer);
        this.widgetContainer = widgetContainer;
        console.log('Widget container appended to body.');

        // Сохраняем контейнер в свойство класса
        this.widgetContainer = widgetContainer;

        // Добавление шрифта в документ
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        // Подключение внешних CSS-файлов
        const stylesheets = [
            'widget.css',
            'suggestion.css',
            'history.css',
            'category.css',
            'container.css',
            'media.css'
        ];

        stylesheets.forEach((stylesheet) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://aleklz89.github.io/widget/${stylesheet}`; // Укажите правильный путь к вашим CSS-файлам
            document.head.appendChild(link);
        });

        // Сохранение ссылок на элементы
        const triggerInput = document.getElementById(this.triggerInputId);
        if (!triggerInput) {
            console.error(`Trigger input с ID "${this.triggerInputId}" не найден.`);
            return;
        }
        console.log('Trigger input найден:', triggerInput);

        // Получение или создание userId
        this.setupEventHandlers(this.widgetContainer, triggerInput);

        // Асинхронно загружаем userId и историю, не блокируя открытие
        this.getOrCreateUserId().then(() => {
            this.loadSearchHistory(this.userId).then(() => {
                this.updateSearchHistory();
                this.addHistoryPopupHandlers();
                console.log('Search history:', this.searchHistory);
            });
        });

        // Сохранение ссылок на элементы для дальнейшего использования
        const searchInput = widgetContainer.querySelector('.widget-search-input');
        const closeButton = widgetContainer.querySelector('.widget-close-button');
        const categoriesContainer = widgetContainer.querySelector('.categories-container');
        const resultContainer = widgetContainer.querySelector('.widget-result-container');
        const suggestionsList = widgetContainer.querySelector('.widget-suggestions-list'); // Ссылка на список подсказок

        // Обработчик для закрытия виджета
        closeButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
        });

        // Обработчик для открытия виджета
        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            searchInput.focus();

            const query = searchInput.value.trim();
            if (query === '') {
                this.showSearchHistory(); // Показываем историю запросов
            } else {
                this.hideSearchHistory(); // Скрываем историю, если есть текст
            }
        });


        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();

            // Генерируем токен запроса (уникальный идентификатор)
            const requestToken = Symbol('requestToken');

            // Сохраняем этот токен как последний активный
            this.currentRequestToken = requestToken;

            if (query === '') {
                this.showSearchHistory();
                suggestionsList.style.display = 'none';
                return;
            } else {
                this.hideSearchHistory();
            }

            this.currentQuery = query;

            if (query.length < 1) {
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                return;
            }

            // Прекращаем предыдущие запросы
            if (this.abortController) {
                this.abortController.abort();
            }
            this.abortController = new AbortController();
            const controller = this.abortController;

            try {
                if (query.length >= 3) {
                    // Запускаем подсказки и поиск продуктов параллельно
                    const suggestionsPromise = this.fetchSuggestions(query, suggestionsList, searchInput, requestToken, controller);
                    const productsPromise = this.fetchProducts(query, categoriesContainer, resultContainer, requestToken, controller);
                    await Promise.all([suggestionsPromise, productsPromise]);
                } else {
                    // Если меньше 3 символов, просто ищем подсказки
                    await this.fetchSuggestions(query, suggestionsList, searchInput, requestToken, controller);
                    resultContainer.innerHTML = '<p>Почніть пошук...</p>';
                    categoriesContainer.innerHTML = '';
                }
            } catch (error) {
                // Обработка ошибок без изменений
                if (error.name === 'AbortError') {
                    console.log('⏹️ Запрос был отменён.');
                } else {
                    console.error('Error during search input processing:', error);
                    resultContainer.innerHTML = '<p>Виникла помилка під час пошуку.</p>';
                    suggestionsList.innerHTML = '<p>Помилка отримання пропозицій</p>';
                }
            }
        });

        // Скрываем подсказки при клике вне инпута или блока
        document.addEventListener('click', (event) => {
            if (suggestionsList && !suggestionsList.contains(event.target) && event.target !== searchInput) {
                suggestionsList.style.display = 'none';
            }
        });
    }

    setupEventHandlers(widgetContainer, triggerInput) {
        const searchInput = widgetContainer.querySelector('.widget-search-input');
        const closeButton = widgetContainer.querySelector('.widget-close-button');
        const categoriesContainer = widgetContainer.querySelector('.categories-container');
        const resultContainer = widgetContainer.querySelector('.widget-result-container');
        const suggestionsList = widgetContainer.querySelector('.widget-suggestions-list');

        // Обработчик для закрытия виджета
        closeButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
        });

        // Обработчик для открытия виджета
        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            searchInput.focus();

            const query = searchInput.value.trim();
            if (query === '') {
                this.showSearchHistory(); // Показываем историю запросов
            } else {
                this.hideSearchHistory(); // Скрываем историю, если есть текст
            }
        });

        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            const requestToken = Symbol('requestToken');
            this.currentRequestToken = requestToken;

            if (query === '') {
                this.showSearchHistory();
                suggestionsList.style.display = 'none';
                return;
            } else {
                this.hideSearchHistory();
            }

            this.currentQuery = query;

            if (query.length < 1) {
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                return;
            }

            if (this.abortController) {
                this.abortController.abort();
            }
            this.abortController = new AbortController();
            const controller = this.abortController;

            try {
                await this.fetchSuggestions(query, suggestionsList, searchInput, requestToken, controller);

                if (query.length >= 3) {
                    await this.fetchProducts(query, categoriesContainer, resultContainer, requestToken, controller);
                } else {
                    resultContainer.innerHTML = '<p>Почніть пошук...</p>';
                    categoriesContainer.innerHTML = '';
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('⏹️ Запрос был отменён.');
                } else {
                    console.error('Error during search input processing:', error);
                    resultContainer.innerHTML = '<p>Виникла помилка під час пошуку.</p>';
                    suggestionsList.innerHTML = '<p>Помилка отримання пропозицій</p>';
                }
            }
        });

        // Скрываем подсказки при клике вне инпута или блока
        document.addEventListener('click', (event) => {
            if (suggestionsList && !suggestionsList.contains(event.target) && event.target !== searchInput) {
                suggestionsList.style.display = 'none';
            }
        });
    }


    updateSearchHistory() {
        console.log('Обновляем историю запросов');
        const historyContainer = document.querySelector('.widget-history-list');
        historyContainer.style.display = 'block';
        if (!historyContainer) return;

        // Очищаем контейнер перед обновлением
        historyContainer.innerHTML = '';

        if (this.searchHistory.length === 0) {
            historyContainer.innerHTML = '<p></p>';
        } else {
            this.searchHistory.forEach((query) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.textContent = query;

                // Обработчик клика по элементу истории
                historyItem.addEventListener('click', () => {
                    const searchInput = document.querySelector('.widget-search-input');
                    searchInput.value = query;
                    searchInput.dispatchEvent(new Event('input'));
                });

                historyContainer.appendChild(historyItem);
            });
        }
    }

    addHistoryPopupHandlers() {
        const searchInput = document.querySelector('.widget-search-input');
        const historyContainer = document.querySelector('.widget-history-container');

        if (!searchInput || !historyContainer) {
            console.warn('Элементы для работы с историей не найдены.');
            return;
        }

        // Показываем историю при фокусе
        searchInput.addEventListener('focus', () => {
            console.log('Фокус на инпуте, история запросов:', this.searchHistory);
            if (this.searchHistory.length > 0) {
                this.showHistory();
            }
        });

        // Закрываем историю при вводе текста
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                this.hideHistory();
            } else {
                this.showHistory();
            }
        });
    }



    showSearchHistory() {
        console.log('Показываем окно с историей'); // Отладочный вывод
        const historyContainer = document.querySelector('.widget-history-container');
        const historyList = document.querySelector('.widget-history-list');
        historyList.innerHTML = '';

        if (this.searchHistory.length === 0) {
            historyList.innerHTML = '<p></p>';
        } else {
            this.searchHistory.forEach((item) => {
                const historyElement = document.createElement('div');
                historyElement.className = 'history-item';
                historyElement.textContent = item;

                historyElement.addEventListener('click', () => {
                    const searchInput = document.querySelector('.widget-search-input');
                    searchInput.value = item;
                    searchInput.dispatchEvent(new Event('input'));
                });

                historyList.appendChild(historyElement);
            });
        }

        historyContainer.style.display = 'block'; // Отображаем контейнер истории
    }

    hideSearchHistory() {
        const historyContainer = document.querySelector('.widget-history-container');
        historyContainer.style.display = 'none';
    }


    async saveSearchQuery(query) {
        if (!this.userId || !query) return;

        try {
            await fetch('https://search-module-chi.vercel.app/api/addSearchQuery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId, query }),
            });
        } catch (error) {
            console.error('Error saving search query:', error);
        }
    }

    async loadSearchHistory(userId) {
        if (!userId) {
            console.error('User ID is missing! Cannot load search history.');
            return;
        }

        console.log("Id пользователя: ", userId)

        try {
            const response = await fetch('https://search-module-chi.vercel.app/api/get-user-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            this.searchHistory = data.history.map((item) => item.query).slice(-5); // Последние 5 запросов
            this.updateSearchHistory();
        } catch (error) {
            console.error('Error loading search history:', error);
        }
    }

    updateSearchHistory() {
        const historyContainer = document.querySelector('.widget-history-list');
        if (!historyContainer) return;

        // Очищаем контейнер перед обновлением
        historyContainer.innerHTML = '';

        if (this.searchHistory.length === 0) {
            historyContainer.innerHTML = '<p></p>';
        } else {
            this.searchHistory.forEach((query) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.textContent = query;

                // Обработчик клика по элементу истории
                historyItem.addEventListener('click', () => {
                    const searchInput = document.querySelector('.widget-search-input');
                    searchInput.value = query;
                    searchInput.dispatchEvent(new Event('input'));
                });

                historyContainer.appendChild(historyItem);
            });
        }
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

    async fetchSuggestions(query, suggestionsList, searchInput, requestToken, controller) {
        console.log('Fetching suggestions for query:', query);
        const response = await fetch(this.suggestionsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: controller.signal
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const suggestions = await response.json();
        console.log('Suggestions received:', suggestions);

        // Проверяем, что этот токен соответствует последнему активному
        if (requestToken !== this.currentRequestToken) {
            console.log('Suggestions response outdated, ignoring.');
            return;
        }

        if (searchInput.value.trim() !== this.currentQuery) {
            console.log('Query changed, skipping suggestions update.');
            return;
        }

        suggestionsList.innerHTML = '';
        if (Array.isArray(suggestions) && suggestions.length > 0) {
            suggestions.forEach((suggestion) => {
                if (!suggestion.word || typeof suggestion.word !== 'string') return;

                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'suggestion-item';
                const boldText = suggestion.word.replace(query, '');
                suggestionItem.innerHTML = `<span>${query}</span><strong>${boldText}</strong>`;

                suggestionItem.addEventListener('click', () => {
                    console.log('Suggestion clicked:', suggestion.word);
                    searchInput.value = suggestion.word;
                    searchInput.dispatchEvent(new Event('input'));
                });

                suggestionsList.appendChild(suggestionItem);
            });
            suggestionsList.style.display = 'flex';
        } else {
            suggestionsList.style.display = 'none';
        }
    }

    async fetchProducts(query, categoriesContainer, resultContainer, requestToken, controller) {
        console.log(`[DEBUG] fetchProducts called with query="${query}"`);

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: query }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const products = await response.json();
        console.log(`[DEBUG] Products response for query="${query}":`, products);

        // Проверяем токен
        if (requestToken !== this.currentRequestToken) {
            console.log('[DEBUG] Products response outdated, ignoring.');
            return;
        }

        if (this.currentQuery !== query) {
            console.log('[DEBUG] currentQuery changed, ignoring results.');
            return;
        }

        if (!Array.isArray(products)) {
            console.log('[DEBUG] Products is not an array:', products);
            return;
        }

        if (products.length === 0) {
            console.log('[DEBUG] No products found');
            resultContainer.innerHTML = '<p>No products found.</p>';
            categoriesContainer.innerHTML = '';
        } else {
            console.log(`[DEBUG] Displaying ${products.length} products`);
            this.displayProductsByCategory(products, categoriesContainer, resultContainer);
        }

        if (this.widgetContainer) {
            const suggestionsList = this.widgetContainer.querySelector('.widget-suggestions-list');
            if (suggestionsList) {
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                suggestionsList.classList.remove('show');
            }
        }
    }


    async saveWordsToDatabase(query) {
        if (!query || typeof query !== 'string') return;

        try {
            await fetch('https://search-module-chi.vercel.app/api/save-words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: query }), // Отправляем введенную строку
            });
            console.log(`Запрос "${query}" успешно отправлен на /api/save-words.`);
        } catch (error) {
            console.error('Ошибка при сохранении строки:', error);
        }
    }


    displayProductsByCategory(products, categoriesContainer, resultContainer) {
        console.log('[DEBUG] Entered displayProductsByCategory with products:', products);
        categoriesContainer.innerHTML = '';
        resultContainer.innerHTML = '';

        if (!Array.isArray(products) || products.length === 0) {
            console.log('[DEBUG] No products to display.');
            resultContainer.innerHTML = '<p>No products found.</p>';
            return;
        }

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
            // Создаем элемент для категории
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';

            // Создаем текст для названия категории
            const categoryText = document.createElement('span');
            categoryText.className = 'category-name';
            categoryText.textContent = categoryName;

            // Создаем блок для количества товаров
            const categoryCount = document.createElement('div');
            categoryCount.className = 'category-count';
            const productCount =
                categoryName === allResultsCategoryName ? products.length : categories[categoryName].length;
            categoryCount.textContent = productCount;

            // Добавляем название категории и количество в контейнер
            categoryItem.appendChild(categoryText);
            categoryItem.appendChild(categoryCount);

            // Добавляем обработчик клика
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
        console.log('[DEBUG] Finished displayProductsByCategory rendering.');
    }

    async showCategoryProducts(groupedProducts, resultContainer, showCategoryTitles = true, selectedCategory = null) {
        console.log('=== Start of showCategoryProducts ===');
        console.log('Grouped Products:', groupedProducts);
        console.log('Selected Category:', selectedCategory);

        const isAllResults = selectedCategory === null;
        console.log('Is All Results:', isAllResults);

        // Устанавливаем количество товаров для отображения
        const maxItemsToShow = isAllResults ? 4 : Number.MAX_SAFE_INTEGER;
        console.log('Max Items to Show:', maxItemsToShow);

        // Обновляем классы .widget-result-container
        if (isAllResults) {
            resultContainer.classList.add('all-results');
        } else {
            resultContainer.classList.remove('all-results');
        }

        resultContainer.innerHTML = '';

        // Загружаем HTML-шаблон для товаров
        console.time('Loading Product Template');
        const templateResponse = await fetch('https://aleklz89.github.io/widget/product-item.html'); // Проверьте путь
        if (!templateResponse.ok) {
            throw new Error(`Failed to load product template: ${templateResponse.status}`);
        }
        const productTemplate = await templateResponse.text();
        console.timeEnd('Loading Product Template');
        console.log('Product Template Loaded:', productTemplate);

        Object.entries(groupedProducts).forEach(([category, items]) => {
            console.log(`Processing category: ${category}`);
            console.log(`Items in category:`, items);

            const isSingleCategory = Object.keys(groupedProducts).length === 1 && !selectedCategory;
            console.log('Is Single Category:', isSingleCategory);

            const categoryTitleHtml = (showCategoryTitles || selectedCategory)
                ? `<h3><a href="#" class="category-link">${category} →</a></h3>`
                : '';

            const categoryBlock = document.createElement('div');
            categoryBlock.className = `category-block ${isSingleCategory ? 'category-single' : 'category-multiple'}`;
            if (categoryTitleHtml) {
                categoryBlock.innerHTML = categoryTitleHtml;
            }

            const productContainer = document.createElement('div');
            productContainer.className = 'product-container';

            // Добавляем товары
            items.slice(0, maxItemsToShow).forEach((item) => {
                console.log('Processing item:', item);

                const price = parseFloat(item.price) || 0;
                const formattedPrice = price.toFixed(2);

                let productHtml = productTemplate
                    .replace(/\{\{imageUrl\}\}/g, item.image || '')
                    .replace(/\{\{name\}\}/g, item.name || 'No Name')
                    .replace(/\{\{price\}\}/g, item.newPrice || 'Unavailable')
                    .replace(/\{\{currencyId\}\}/g, item.currencyId || 'USD')
                    .replace(/\{\{presence\}\}/g, item.availability ? 'В наявності' : 'Немає в наявності');

                console.log('Generated Product HTML:', productHtml);

                const productElement = document.createElement('div');
                productElement.innerHTML = productHtml.trim();

                // Оборачиваем блок товара в ссылку или делаем его кликабельным
                const productWrapper = document.createElement('a');
                productWrapper.href = item.url || '#'; // Назначаем URL товара
                productWrapper.target = '_blank'; // Открытие в новой вкладке (опционально)
                productWrapper.className = 'product-link';

                productWrapper.appendChild(productElement.firstElementChild);
                productContainer.appendChild(productWrapper);
            });

            // Кнопка "ще", только во "Всі результати"
            if (isAllResults && items.length > maxItemsToShow) {
                const moreLink = document.createElement('div');
                moreLink.className = 'more-link';
                moreLink.textContent = `ще ${items.length - maxItemsToShow} ...`;

                moreLink.addEventListener('click', () => {
                    console.log(`More link clicked for category: ${category}`);
                    this.showCategoryProducts({ [category]: items }, resultContainer, true, category);
                    this.activateCategory(category);
                });

                productContainer.appendChild(moreLink);
            }

            categoryBlock.appendChild(productContainer);
            resultContainer.appendChild(categoryBlock);
        });

        console.log('Final result container:', resultContainer.innerHTML);
        console.log('=== End of showCategoryProducts ===');
    }




    async loadTemplate(templatePath) {
        const response = await fetch(templatePath);
        if (!response.ok) {
            throw new Error(`Failed to load template: ${templatePath}`);
        }
        return await response.text();
    }

    activateCategory(categoryName) {
        const categoriesContainer = document.querySelector('.categories-container');
        const categoryItems = categoriesContainer.getElementsByClassName('category-item');

        Array.from(categoryItems).forEach((item) => {
            if (item.querySelector('.category-name').textContent === categoryName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }


}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded event fired');

    const triggerInputId = 'searchInput';
    new ProductSearchWidget(triggerInputId);
});