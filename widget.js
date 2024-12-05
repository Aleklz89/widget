class ProductSearchWidget {
    constructor(triggerInputId) {
        this.triggerInputId = triggerInputId;
        this.apiUrl = 'http://localhost:3000/api/search';
        this.suggestionsUrl = 'https://search-module-chi.vercel.app/api/search-suggestions';
        this.correctionUrl = 'https://search-module-chi.vercel.app/api/correct';
        this.searchHistory = [];
        this.abortController = null; // Инициализация abortController как свойства класса
        this.currentQuery = null; // Отслеживание текущего запроса
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
        const response = await fetch('widget.html'); // Убедитесь, что путь к widget.html корректен
        const widgetHtml = await response.text();

        const widgetContainerWrapper = document.createElement('div');
        widgetContainerWrapper.innerHTML = widgetHtml.trim();
        const widgetContainer = widgetContainerWrapper.firstElementChild;
        console.log('Widget container created:', widgetContainer);
        document.body.appendChild(widgetContainer);
        console.log('Widget container appended to body.');

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
            link.href = `${stylesheet}`; // Укажите правильный путь к вашим CSS-файлам
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
        await this.getOrCreateUserId();

        // Загружаем историю
        await this.loadSearchHistory(this.userId);
        this.updateSearchHistory();

        // Настраиваем обработчики истории
        this.addHistoryPopupHandlers();

        // Проверяем историю
        console.log('Search history:', this.searchHistory);

        // Сохранение ссылок на элементы для дальнейшего использования
        const searchInput = widgetContainer.querySelector('.widget-search-input');
        const closeButton = widgetContainer.querySelector('.widget-close-button');
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

            const query = searchInput.value.trim();
            if (query === '') {
                this.showSearchHistory(); // Показываем историю запросов
            } else {
                this.hideSearchHistory(); // Скрываем историю, если есть текст
            }
        });

        // Используем AbortController для управления запросами
        let abortController = null;

        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            const suggestionsList = widgetContainer.querySelector('.widget-suggestions-list');

            // Если поле пустое, показываем историю запросов
            if (query === '') {
                this.showSearchHistory();
                suggestionsList.style.display = 'none'; // Скрываем подсказки
                return;
            } else {
                this.hideSearchHistory();
            }

            // Сохранение текущего запроса
            this.currentQuery = query;

            // Проверка минимальной длины запроса для подсказок
            if (query.length < 1) {
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none'; // Скрыть подсказки, если их нет
                return;
            }

            // Отменяем предыдущий запрос, если он существует
            if (abortController) {
                console.log('⏹️ Отмена предыдущего запроса.');
                abortController.abort();
            }

            // Создаем новый AbortController
            abortController = new AbortController();

            try {
                // Показ подсказок и обновление результатов
                await this.fetchSuggestions(query, suggestionsList, searchInput, abortController);

                // Обновляем результаты поиска только при длине строки >= 3
                if (query.length >= 3) {
                    await this.fetchProducts(query, categoriesContainer, resultContainer, abortController);
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
            if (!suggestionsList.contains(event.target) && event.target !== searchInput) {
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

    async fetchSuggestions(query, suggestionsList, searchInput) {
        console.log('Fetching suggestions for query:', query); // Лог текущего запроса
        try {
            const response = await fetch(this.suggestionsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const suggestions = await response.json();

            // Лог полученных подсказок
            console.log('Suggestions received from API:', suggestions);

            // Проверяем актуальность запроса
            if (searchInput.value.trim() !== this.currentQuery) {
                console.log('Query changed, skipping suggestions update.'); // Лог изменения запроса
                return;
            }

            suggestionsList.innerHTML = ''; // Очищаем предыдущие подсказки

            if (Array.isArray(suggestions) && suggestions.length > 0) {
                suggestions.forEach((suggestion) => {
                    // Проверяем, есть ли свойство word и является ли оно строкой
                    if (!suggestion.word || typeof suggestion.word !== 'string') {
                        console.warn('Invalid suggestion object, skipping:', suggestion);
                        return; // Пропускаем некорректный элемент
                    }

                    const suggestionItem = document.createElement('div');
                    suggestionItem.className = 'suggestion-item';

                    // Разделяем текст подсказки: общая часть (query) и оставшаяся часть
                    const boldText = suggestion.word.replace(query, '');

                    suggestionItem.innerHTML = `<span>${query}</span><strong>${boldText}</strong>`;

                    // Добавляем обработчик клика по подсказке
                    suggestionItem.addEventListener('click', () => {
                        console.log('Suggestion clicked:', suggestion.word); // Лог клика по подсказке
                        searchInput.value = suggestion.word; // Устанавливаем выбранное слово в инпут
                        searchInput.dispatchEvent(new Event('input')); // Тригерим обновление поиска
                    });

                    suggestionsList.appendChild(suggestionItem);
                });

                suggestionsList.style.display = 'flex'; // Показываем блок с подсказками
            } else {
                console.log('No suggestions found for query:', query); // Лог отсутствия подсказок
                suggestionsList.style.display = 'none'; // Скрываем, если подсказок нет
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            suggestionsList.innerHTML = '<p>Помилка отримання пропозицій</p>';
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


    async fetchProducts(query, categoriesContainer, resultContainer) {
        console.log(`🔍 Запрос на поиск: ${query}`);

        // Отменяем предыдущий запрос, если он существует
        if (this.abortController) {
            console.log('⏹️ Отмена предыдущего запроса');
            this.abortController.abort();
        }

        // Создаём новый AbortController
        this.abortController = new AbortController();

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ word: query }),
                signal: this.abortController.signal, // Привязываем сигнал к запросу
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const products = await response.json();
            console.log(`✅ Успешно получены продукты для запроса: "${query}"`, products);

            // Проверяем, не изменился ли запрос
            if (this.currentQuery !== query) {
                console.log('🚫 Запрос устарел, игнорируем результаты.');
                return;
            }

            if (products.length === 0) {
                resultContainer.innerHTML = '<p>No products found.</p>';
                categoriesContainer.innerHTML = '';
            } else {
                this.displayProductsByCategory(products, categoriesContainer, resultContainer);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('⏹️ Запрос был отменён.');
            } else {
                console.error('❌ Ошибка при получении продуктов:', error);
                resultContainer.innerHTML = '<p>Error fetching products.</p>';
            }
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
        const templateResponse = await fetch('product-item.html'); // Проверьте путь
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
                    .replace(/\{\{image\}\}/g, item.image || '')
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
    const triggerInputId = 'searchInput';
    new ProductSearchWidget(triggerInputId);
});
