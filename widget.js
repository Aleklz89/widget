class ProductSearchWidget {
    constructor(triggerInputId) {
        console.log('[LOG:constructor] Initializing with triggerInputId:', triggerInputId);
        this.triggerInputId = triggerInputId;

        // Эндпоинты
        this.apiUrl = 'https://smartsearch.spefix.com/api/search';
        this.suggestionsUrl = 'https://smartsearch.spefix.com/api/suggestions';
        this.correctionUrl = 'https://smartsearch.spefix.com/api/correct';
        this.languageRoute = 'https://smartsearch.spefix.com/api/language';

        // Состояние
        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.siteDomain = window.location.pathname;
        this.allProducts = [];
        this.activeFilters = {};

        // Сколько товаров показывать на вкладке «Всі результати» в каждой категории
        this.maxItemsOnAllResults = 4;

        // Тексты на нужном языке (упрощённый пример)
        this.translationsMap = {
            ru: {
                searchPlaceholder: 'Поиск...',
                allResults: 'Все результаты',
                filters: 'Фильтры',
                categories: 'Категории',
                noProductsFound: 'Товаров не найдено.',
                inStock: 'В наличии',
                outOfStock: 'Нет в наличии',
                startSearch: 'Начните поиск...',
                more: 'Еще'
            },
            uk: {
                searchPlaceholder: 'Пошук...',
                allResults: 'Всі результати',
                filters: 'Фільтри',
                categories: 'Категорії',
                noProductsFound: 'Товарів не знайдено',
                inStock: 'В наявності',
                outOfStock: 'Немає в наявності',
                startSearch: 'Почніть пошук...',
                more: 'Ще'
            },
            en: {
                searchPlaceholder: 'Search...',
                allResults: 'All results',
                filters: 'Filters',
                categories: 'Categories',
                noProductsFound: 'No products found.',
                inStock: 'In stock',
                outOfStock: 'Out of stock',
                startSearch: 'Start searching...',
                more: 'More'
            },
            pl: {
                searchPlaceholder: 'Szukaj...',
                allResults: 'Wszystkie wyniki',
                filters: 'Filtry',
                categories: 'Kategorie',
                noProductsFound: 'Nie znaleziono produktów.',
                inStock: 'Dostępne',
                outOfStock: 'Niedostępne',
                startSearch: 'Rozpocznij wyszukiwanie...',
                more: 'Więcej'
            },
            de: {
                searchPlaceholder: 'Suche...',
                allResults: 'Alle Ergebnisse',
                filters: 'Filter',
                categories: 'Kategorien',
                noProductsFound: 'Keine Produkte gefunden.',
                inStock: 'Auf Lager',
                outOfStock: 'Nicht vorrätig',
                startSearch: 'Beginnen Sie mit der Suche...',
                more: 'Mehr'
            }
        };

        this.initWidget();
    }

    showHistory() {
        const historyList = document.querySelector('.widget-history-list');
        if (historyList) historyList.classList.add('show');
    }
    hideHistory() {
        const historyList = document.querySelector('.widget-history-list');
        if (historyList) historyList.classList.remove('show');
    }

    async initWidget() {
        console.log('[LOG:initWidget] Start.');

        // 1a) Сначала узнаём язык (используя siteDomain или любой path):
        const userLang = await this.fetchInterfaceLanguage(this.siteDomain);
        if (userLang) {
            this.applyTranslations(userLang);
        }

        // 1) Загружаем HTML
        // const resp = await fetch('https://aleklz89.github.io/widget/widget.html');
        const resp = await fetch('widget.html');
        const widgetHtml = await resp.text();

        // 2) Создаём DOM-элемент
        const tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = widgetHtml.trim();
        this.widgetContainer = tmpDiv.firstElementChild;
        document.body.appendChild(this.widgetContainer);

        // 3) Подключаем шрифты
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap';
        document.head.appendChild(fontLink);

        // 4) Стили
        const sheets = [
            'widget.css',
            'suggestion.css',
            'history.css',
            'category.css',
            'container.css',
            'media.css'
        ];
        sheets.forEach((stylesheet) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://aleklz89.github.io/widget/${stylesheet}`;
            // link.href = `${stylesheet}`;
            document.head.appendChild(link);
        });

        // Дополнительные стили для аккордеона и т.д.
        const styleTag = document.createElement('style');
        styleTag.textContent = `
        /* Панель фильтров */
        .filter-container {
          background: #f9f9f9;
          overflow-y: auto;
          transition: height 0.3s ease;
        }
    
        .filter-content {
          padding: 10px;
        }
        .filter-param-block {
          margin-bottom: 12px;
        }
        .filter-checkbox-label {
          display: block;
          margin-bottom: 5px;
        }
        
  
        /* Ограничение на вывод */
        .product-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .more-link {
          margin: 10px 0;
          color: #007bff;
          cursor: pointer;
          font-weight: bold;
        }
      `;
        document.head.appendChild(styleTag);

        // 5) Ищем триггеры
        const triggers = document.querySelectorAll(`#${this.triggerInputId}`);
        if (!triggers.length) {
            console.error('[LOG:initWidget] No triggers found');
            return;
        }
        triggers.forEach((inp) => this.setupEventHandlers(this.widgetContainer, inp));

        // 6) userId  история
        await this.getOrCreateUserId();
        await this.loadSearchHistory(this.userId);
        this.updateSearchHistory();
        this.addHistoryPopupHandlers();

        // 7) Создаем панель фильтров  панель категорий
        this.createFilterAccordion();
        this.createCategoryAccordion();

        this.adjustDefaultPanels();
    }

    adjustDefaultPanels() {
        console.log('[LOG:adjustDefaultPanels] Start.');

        // Смотрим, какая сейчас ширина окна
        const currentWidth = window.innerWidth;
        console.log('[LOG:adjustDefaultPanels] window.innerWidth=', currentWidth);

        // Находим элементы
        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const catAccordion = this.widgetContainer.querySelector('.category-accordion');

        // Логируем найденные элементы
        console.log('[LOG:adjustDefaultPanels] filterContainer=', filterContainer);
        console.log('[LOG:adjustDefaultPanels] catAccordion=', catAccordion);

        if (!filterContainer || !catAccordion) {
            console.warn('[LOG:adjustDefaultPanels] filterContainer or catAccordion not found => return');
            return;
        }

        // Если экран шире 1100px => хотим, чтобы они были "свернуты"
        if (currentWidth < 1100) {
            console.log('[LOG:adjustDefaultPanels] => collapsing filters & categories (because width > 1100).');
            filterContainer.classList.add('collapsed');
            catAccordion.classList.add('collapsed');
        } else {
            console.log('[LOG:adjustDefaultPanels] => uncollapsing filters & categories (width <= 1100).');
            filterContainer.classList.remove('collapsed');
            catAccordion.classList.remove('collapsed');
        }
    }

    createFilterAccordion() {
        console.log('[LOG:createFilterAccordion] Inserting filter panel');
        const filterContainer = document.createElement('div');
        // По умолчанию мы добавляем класс 'collapsed', но потом adjustDefaultPanels() может его «снять»
        filterContainer.className = 'filter-container collapsed';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'filter-toggle-btn';
        toggleBtn.textContent = `${this.translations.filters} ▼`;

        toggleBtn.addEventListener('click', () => {
            console.log('[LOG:createFilterAccordion] filter-toggle-btn clicked');
            filterContainer.classList.toggle('collapsed');

            const isCollapsedNow = filterContainer.classList.contains('collapsed');
            console.log('[LOG:createFilterAccordion] isCollapsedNow=', isCollapsedNow);

            if (isCollapsedNow) {
                toggleBtn.textContent = `${this.translations.filters} ▼`;
            } else {
                toggleBtn.textContent = `${this.translations.filters} ▲`;
            }
        });

        const filterContent = document.createElement('div');
        filterContent.className = 'filter-content';

        filterContainer.appendChild(toggleBtn);
        filterContainer.appendChild(filterContent);

        const leftCol = this.widgetContainer.querySelector('.left-column');
        console.log('[LOG:createFilterAccordion] leftCol=', leftCol);

        if (leftCol) {
            const categoriesContainer = leftCol.querySelector('.categories-container');
            console.log('[LOG:createFilterAccordion] categoriesContainer=', categoriesContainer);

            leftCol.insertBefore(filterContainer, categoriesContainer);
            console.log('[LOG:createFilterAccordion] Filter panel inserted above .categories-container');
        } else {
            console.warn('[LOG:createFilterAccordion] .left-column not found => insertBefore(widgetContainer.firstChild)');
            this.widgetContainer.insertBefore(filterContainer, this.widgetContainer.firstChild);
        }
    }

    createCategoryAccordion() {
        console.log('[LOG:createCategoryAccordion] Creating category accordion block...');

        const leftCol = this.widgetContainer.querySelector('.left-column');
        const catsContainer = this.widgetContainer.querySelector('.categories-container');
        if (!leftCol || !catsContainer) {
            console.warn('[LOG:createCategoryAccordion] No .left-column or .categories-container found.');
            return;
        }

        // Создаем аккордеон
        const catAccordion = document.createElement('div');
        catAccordion.className = 'category-accordion collapsed';
        // По умолчанию ставим класс 'collapsed', чтобы при старте он был свернут
        // Если хотите, чтобы при загрузке было раскрыто — уберите слово collapsed

        // Шапка
        const catHeader = document.createElement('div');
        catHeader.className = 'category-accordion-header';
        catHeader.textContent = `${this.translations.categories} ▼`; // начальное значение

        // Добавляем обработчик клика по шапке
        catHeader.addEventListener('click', () => {
            catAccordion.classList.toggle('collapsed');
            if (catAccordion.classList.contains('collapsed')) {
                catHeader.textContent = `${this.translations.categories} ▼`;
            } else {
                catHeader.textContent = `${this.translations.categories} ▲`;
            }
        });

        // Контейнер для списка категорий
        const catContent = document.createElement('div');
        catContent.className = 'category-accordion-content';

        catContent.appendChild(catsContainer);
        catAccordion.appendChild(catHeader);
        catAccordion.appendChild(catContent);

        // Вставляем его в левую колонку, сразу после filter-container
        const filterCont = leftCol.querySelector('.filter-container');
        if (filterCont) {
            leftCol.insertBefore(catAccordion, filterCont.nextSibling);
        } else {
            leftCol.appendChild(catAccordion);
        }
    }

    buildFilterMenu() {
        console.log('[LOG:buildFilterMenu] Building filter checkboxes...');
        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const filterContent = filterContainer?.querySelector('.filter-content');
        if (!filterContainer || !filterContent) {
            console.warn('[LOG:buildFilterMenu] filterContainer or filterContent not found!');
            return;
        }

        filterContent.innerHTML = '';

        const filterData = {};
        this.allProducts.forEach((prod) => {
            if (!Array.isArray(prod.params)) return;
            prod.params.forEach((p) => {
                if (!filterData[p.name]) {
                    filterData[p.name] = new Set();
                }
                filterData[p.name].add(p.value);
            });
        });

        Object.keys(filterData).forEach((paramName) => {
            const paramBlock = document.createElement('div');
            paramBlock.className = 'filter-param-block';

            const titleEl = document.createElement('h4');
            titleEl.textContent = paramName;
            paramBlock.appendChild(titleEl);

            const valArr = Array.from(filterData[paramName]);
            valArr.forEach((val) => {
                const label = document.createElement('label');
                label.className = 'filter-checkbox-label';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'filter-checkbox';
                checkbox.value = val;

                checkbox.addEventListener('change', () => {
                    if (!this.activeFilters[paramName]) {
                        this.activeFilters[paramName] = new Set();
                    }
                    if (checkbox.checked) {
                        this.activeFilters[paramName].add(val);
                    } else {
                        this.activeFilters[paramName].delete(val);
                        if (!this.activeFilters[paramName].size) {
                            delete this.activeFilters[paramName];
                        }
                    }
                    console.log('[LOG:buildFilterMenu] activeFilters=', this.activeFilters);

                    const filtered = this.applyActiveFilters(this.allProducts);
                    const cats = this.widgetContainer.querySelector('.categories-container');
                    const res = this.widgetContainer.querySelector('.widget-result-container');
                    this.displayProductsByCategory(filtered, cats, res);
                });

                const spanVal = document.createElement('span');
                spanVal.textContent = val;

                label.appendChild(checkbox);
                label.appendChild(spanVal);
                paramBlock.appendChild(label);
            });

            filterContent.appendChild(paramBlock);
        });
    }

    applyActiveFilters(products) {
        console.log('[LOG:applyActiveFilters] activeFilters=', this.activeFilters);
        const keys = Object.keys(this.activeFilters);
        if (!keys.length) return products;

        return products.filter((prod) => {
            for (const paramName of keys) {
                const neededVals = this.activeFilters[paramName];
                const found = prod.params?.find((p) => p.name === paramName);
                if (!found) return false;
                if (!neededVals.has(found.value)) return false;
            }
            return true;
        });
    }

    setupEventHandlers(widgetContainer, triggerInput) {
        console.log('[LOG:setupEventHandlers]', triggerInput);
        const sInput = widgetContainer.querySelector('.widget-search-input');
        const cButton = widgetContainer.querySelector('.widget-close-button');
        const catsCont = widgetContainer.querySelector('.categories-container');
        const resCont = widgetContainer.querySelector('.widget-result-container');
        const suggList = widgetContainer.querySelector('.widget-suggestions-list');

        cButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
        });

        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            sInput.focus();
            const q = sInput.value.trim();
            if (!q) this.showHistory(); else this.hideHistory();
        });

        sInput.addEventListener('input', async (e) => {
            let query = e.target.value;
            const reqToken = Symbol('requestToken');
            this.currentRequestToken = reqToken;

            const last = query.slice(-1);
            if (last === ' ') {
                query = query.trimEnd();
                await this.correctQuery(query, sInput);
                query = sInput.value;
                this.currentQuery = query;
            }

            if (!query.trim()) {
                this.showHistory();
                suggList.style.display = 'none';
                return;
            } else {
                this.hideHistory();
            }

            if (this.abortController) this.abortController.abort();
            this.abortController = new AbortController();
            const controller = this.abortController;

            if (query.trim().length < 1) {
                suggList.innerHTML = '';
                suggList.style.display = 'none';
                return;
            }

            try {
                await this.fetchSuggestions(query.trim(), suggList, sInput, reqToken, controller);
                if (query.trim().length >= 3) {
                    await this.fetchProducts(query.trim(), catsCont, resCont, reqToken, controller);
                } else {
                    resCont.innerHTML = `<p>${this.translations.startSearch}</p>`;
                    catsCont.innerHTML = '';
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('[LOG:setupEventHandlers] Request aborted.');
                } else {
                    console.error('[LOG:setupEventHandlers] Error:', err);
                    resCont.innerHTML = `<p>${this.translations.errorWhileSearch || 'Error in search...'}</p>`;
                    suggList.innerHTML = `<p>${this.translations.errorWhileSuggestions || 'Error in suggestions...'}</p>`;
                }
            }
        });

        document.addEventListener('click', (evt) => {
            if (suggList && !suggList.contains(evt.target) && evt.target !== sInput) {
                suggList.style.display = 'none';
            }
        });
    }

    async getOrCreateUserId() {
        if (!window.Cookies) await this.loadJsCookieLibrary();

        // Возьмём хостнейм, например "example.com"
        // Можете взять более специфичную часть пути, если нужно.
        const domain = window.location.hostname || 'unknown-domain';
        // Сформируем название куки вида userId_example.com
        const cookieName = `userId_${domain}`;

        let userId = Cookies.get(cookieName);
        if (!userId) {
            userId = Math.floor(Math.random() * 1e9).toString();
            Cookies.set(cookieName, userId, { expires: 365 });
        }
        this.userId = userId;
        console.log('[LOG:getOrCreateUserId]', { cookieName, userId });
    }

    async loadJsCookieLibrary() {
        if (window.Cookies) return;
        return new Promise((res, rej) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js';
            script.onload = () => res();
            script.onerror = () => rej(new Error('Failed to load js-cookie'));
            document.head.appendChild(script);
        });
    }

    async loadSearchHistory(userId) {
        // передаем еще и domain
        const fullPathNoQuery = window.location.origin + window.location.pathname;
        try {
            const r = await fetch('https://smartsearch.spefix.com/api/get-user-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, fullPathNoQuery }),
            });
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            const data = await r.json();
            this.searchHistory = data.history.map((x) => x.query).slice(-5);
        } catch (err) {
            console.error('[LOG:loadSearchHistory] Error:', err);
        }
    }

    updateSearchHistory() {
        const hist = document.querySelector('.widget-history-list');
        if (!hist) return;

        hist.innerHTML = '';
        if (!this.searchHistory.length) {
            hist.innerHTML = '<p></p>';
        } else {
            this.searchHistory.forEach((q) => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.textContent = q;
                item.addEventListener('click', () => {
                    const sIn = document.querySelector('.widget-search-input');
                    sIn.value = q;
                    sIn.dispatchEvent(new Event('input'));
                });
                hist.appendChild(item);
            });
        }
    }
    addHistoryPopupHandlers() {
        const sInp = document.querySelector('.widget-search-input');
        const histC = document.querySelector('.widget-history-container');
        if (!sInp || !histC) return;
        sInp.addEventListener('focus', () => {
            if (this.searchHistory.length) this.showHistory();
        });
        sInp.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (q.length > 0) {
                this.hideHistory();
            } else {
                this.showHistory();
            }
        });
    }
    showSearchHistory() {
        const c = document.querySelector('.widget-history-container');
        if (c) c.style.display = 'block';
    }
    hideSearchHistory() {
        const c = document.querySelector('.widget-history-container');
        if (c) c.style.display = 'none';
    }

    async fetchSuggestions(query, suggestionsList, searchInput, requestToken, controller) {
        console.log('[LOG:fetchSuggestions] query=', query);
        const r = await fetch(this.suggestionsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, domain: this.siteDomain }),
            signal: controller.signal
        });
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
        const data = await r.json();
        if (requestToken !== this.currentRequestToken) {
            console.log('[LOG:fetchSuggestions] Outdated => ignoring');
            return;
        }
        let filtered = [];
        if (Array.isArray(data)) {
            filtered = data.filter((s) => s.word && s.word.trim().toLowerCase() !== query.trim().toLowerCase());
        }
        if (!filtered.length) {
            suggestionsList.style.display = 'none';
            return;
        }
        suggestionsList.innerHTML = '';
        filtered.forEach((sObj) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            const boldText = sObj.word.replace(query, '');
            item.innerHTML = `<span>${query}</span><strong>${boldText}</strong>`;
            item.addEventListener('click', () => {
                searchInput.value = sObj.word;
                searchInput.dispatchEvent(new Event('input'));
            });
            suggestionsList.appendChild(item);
        });
        suggestionsList.style.display = 'flex';
    }

    async correctQuery(word, searchInput) {
        console.log('[LOG:correctQuery] word=', word);
        try {
            const r = await fetch(this.correctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word })
            });
            if (!r.ok) throw new Error(`HTTP error! status=${r.status}`);
            const data = await r.json();
            if (data && data.incorrectWord && data.correctWord) {
                const corrected = searchInput.value
                    .trim()
                    .split(' ')
                    .map((w) =>
                        w.toLowerCase() === data.incorrectWord.toLowerCase() ? data.correctWord : w
                    )
                    .join(' ');
                searchInput.value = corrected;
                console.log('[LOG:correctQuery] corrected=', corrected);
            }
        } catch (err) {
            console.error('[LOG:correctQuery] Error:', err);
        }
    }

    async fetchProducts(query, categoriesContainer, resultContainer, requestToken, controller) {
        console.log('[LOG:fetchProducts] query=', query);
        const lang = navigator.language || 'en';
        const r = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: query, domain: this.siteDomain, language: lang }),
            signal: controller.signal
        });
        if (!r.ok) throw new Error(`HTTP error! status=${r.status}`);
        const products = await r.json();
        if (requestToken !== this.currentRequestToken) {
            console.log('[LOG:fetchProducts] Outdated => ignoring');
            return;
        }
        if (!Array.isArray(products)) {
            console.log('[LOG:fetchProducts] Not array => ignoring');
            return;
        }
        this.allProducts = products;
        console.log('[LOG:fetchProducts] allProducts length=', products.length);

        // 1) Достаём левую колонку
        const leftCol = this.widgetContainer.querySelector('.left-column');

        if (!products.length) {
            // Нет товаров
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            categoriesContainer.innerHTML = '';

            // Если хотите, дополнительно прячем левую колонку
            if (leftCol) leftCol.style.display = 'none';
        } else {
            // Есть товары
            // Показываем левую колонку
            if (leftCol) leftCol.style.display = 'flex';  // или 'block', как нужно

            this.buildFilterMenu(); // фильтры
            const filtered = this.applyActiveFilters(products);
            this.displayProductsByCategory(filtered, categoriesContainer, resultContainer);

            await this.saveSearchQuery(query);
            await this.saveWordsToDatabase(query);
        }
    }

    displayProductsByCategory(products, categoriesContainer, resultContainer) {
        console.log('[LOG:displayProductsByCategory] products.length=', products.length);

        // 1) Находим .filter-container и .category-accordion (или .categories-container)
        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const catAccordion = this.widgetContainer.querySelector('.category-accordion');

        // 2) Очищаем содержимое
        categoriesContainer.innerHTML = '';
        resultContainer.innerHTML = '';

        // 3) Если товаров нет — скрываем фильтр/категории, показываем «нет товаров» и выходим
        if (!products.length) {
            if (filterContainer) filterContainer.style.display = 'none';
            if (catAccordion) catAccordion.style.display = 'none';

            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            return;
        } else {
            // 4) Есть товары: показываем фильтры и категории (flex вместо block)
            if (filterContainer) filterContainer.style.display = 'flex';
            if (catAccordion) catAccordion.style.display = 'flex';
        }

        // --- Дальше ваша уже существующая логика ---

        // 1) Группируем товары по категориям
        const catMap = {};
        products.forEach((p) => {
            if (!p.categories) return;
            p.categories.forEach((cat) => {
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(p);
            });
        });

        // 2) Подсчитываем «очки» (score) для каждой категории
        const categoryScores = {};
        Object.entries(catMap).forEach(([catName, items]) => {
            const inStock = items.filter((x) => x.availability);
            const outStock = items.filter((x) => !x.availability);
            const sortedItems = [...inStock, ...outStock];
            const subset = sortedItems.slice(0, this.maxItemsOnAllResults);

            let score = 0;
            subset.forEach((prd) => {
                if (prd.availability) score += 1;
                else score -= 1;
            });
            categoryScores[catName] = score;
            console.log(`[DEBUG-catScore] Category="${catName}", subset.length=${subset.length}, score=${score}`);
        });

        // 3) Собираем список категорий
        const catNames = Object.keys(catMap);

        // 4) Сортируем catNames по убыванию score
        catNames.sort((a, b) => (categoryScores[b] || 0) - (categoryScores[a] || 0));

        // 5) Вставляем «Всі результати» (или "Все результаты") в начало
        const allResultsName = this.translations.allResults || 'Всі результати';
        const finalCats = [allResultsName, ...catNames];
        console.log('[DEBUG-catScore] Итоговый порядок категорий:', finalCats);

        // 6) Рендер категорий
        finalCats.forEach((catName) => {
            const cItem = document.createElement('div');
            cItem.className = 'category-item';

            const cText = document.createElement('span');
            cText.className = 'category-name';
            cText.textContent = catName;

            const cCount = document.createElement('div');
            cCount.className = 'category-count';
            if (catName === allResultsName) {
                cCount.textContent = products.length;
            } else {
                cCount.textContent = catMap[catName].length;
            }

            cItem.appendChild(cText);
            cItem.appendChild(cCount);

            cItem.addEventListener('click', () => {
                Array.from(categoriesContainer.getElementsByClassName('category-item'))
                    .forEach((el) => el.classList.remove('active'));
                cItem.classList.add('active');

                if (catName === allResultsName) {
                    this.showCategoryProducts(catMap, finalCats, resultContainer, true, null);
                } else {
                    const singleObj = { [catName]: catMap[catName] };
                    this.showCategoryProducts(singleObj, [catName], resultContainer, true, catName);
                }
            });

            if (catName === allResultsName) {
                cItem.classList.add('active');
            }
            categoriesContainer.appendChild(cItem);
        });

        // 7) Сразу показываем «Всі результати» 
        this.showCategoryProducts(catMap, finalCats, resultContainer, true, null);
    }



    async showCategoryProducts(
        groupedProducts,
        finalCategoryNames,  // это уже отсортированный список
        resultContainer,
        showTitles = true,
        selectedCat = null
    ) {
        console.log('[LOG:showCategoryProducts] selectedCat=', selectedCat);
        const isAllResults = (selectedCat === null);

        resultContainer.innerHTML = '';

        // Грузим шаблон
        const tResp = await fetch('https://aleklz89.github.io/widget/product-item.html');
        // const tResp = await fetch('product-item.html');
        if (!tResp.ok) throw new Error(`Failed to load product template: ${tResp.status}`);
        const productTemplate = await tResp.text();

        // Если мы в режиме «Всі результати»:
        if (isAllResults) {
            // ⚠️ Вместо Object.entries(...) используем finalCategoryNames (уже отсортированные).
            // Скипаем сам "Всі результати" (т.е. finalCategoryNames[0]) и идём со 2-го элемента
            // (или фильтруем его).
            for (const catName of finalCategoryNames) {
                // Пропускаем "Всі результати"
                if (catName === this.translations.allResults) continue;

                const items = groupedProducts[catName] || [];
                this.renderSingleCategoryBlock(
                    catName,
                    items,
                    productTemplate,
                    resultContainer,
                    showTitles,
                    null,
                    this.maxItemsOnAllResults
                );
            }
        } else {
            // Если кликаем по конкретной категории — рендерим только её (без лимита)
            for (const catName of finalCategoryNames) {
                const arr = groupedProducts[catName] || [];
                this.renderSingleCategoryBlock(
                    catName,
                    arr,
                    productTemplate,
                    resultContainer,
                    showTitles,
                    selectedCat,
                    Number.MAX_SAFE_INTEGER
                );
            }
        }
    }



    renderSingleCategoryBlock(
        catName,
        items,
        productTemplate,
        resultContainer,
        showTitles,
        selectedCat,
        limitCount
    ) {
        console.log('[LOG:renderSingleCategoryBlock] catName=', catName, 'items.length=', items.length);

        const isSingle = !!selectedCat;
        const categoryTitleHtml = (showTitles || selectedCat)
            ? `<h3><a href="#" class="category-link">${catName} →</a></h3>`
            : '';

        const catBlock = document.createElement('div');
        catBlock.className = `category-block ${isSingle ? 'category-single' : 'category-multiple'}`;
        if (categoryTitleHtml) {
            catBlock.innerHTML = categoryTitleHtml;
        }

        const productContainer = document.createElement('div');
        productContainer.className = 'product-container';

        // Возможные цвета для лейбла
        const possibleColors = ['#E91E63', '#2196F3', '#4CAF50', '#9C27B0', '#FF5722', '#FF9800'];

        // Сортируем товары: сначала inStock → потом outOfStock
        const inS = items.filter((p) => p.availability);
        const outS = items.filter((p) => !p.availability);
        const sorted = [...inS, ...outS];

        // Обрезаем по limitCount
        const subset = sorted.slice(0, limitCount);

        // Если не заведена карта цветов лейблов – создаём
        if (!this.labelColorMap) {
            this.labelColorMap = {};
        }

        subset.forEach((prod, idx) => {
            console.log('[DEBUG] product item idx=', idx, ' data=', prod);

            // Лейбл
            let labelHtml = '';
            if (prod.label) {
                // Проверяем цвет для данного текста
                if (!this.labelColorMap[prod.label]) {
                    const randColor = possibleColors[Math.floor(Math.random() * possibleColors.length)];
                    this.labelColorMap[prod.label] = randColor;
                }
                const labelColor = this.labelColorMap[prod.label];
                labelHtml = `
          <div class="product-label"
               style="
                 background-color: ${labelColor};
                 color: #fff;
                 display: inline-block;
                 padding: 3px 6px;
                 border-radius: 4px;
                 font-size: 12px;
                 margin-bottom: 5px;">
            ${escapeHtml(prod.label)}
          </div>`;
            }

            // Старая цена
            let oldPriceValue = prod.oldPrice || '';
            // По умолчанию скрыто
            let oldPriceStyle = 'display: none;';
            if (prod.oldPrice && prod.oldPrice > 0 && prod.oldPrice !== prod.newPrice) {
                // Зададим стиль зачёркнутой цены
                oldPriceStyle = 'color: grey; font-size: 13px; text-decoration: line-through;';
            }
            console.log('[DEBUG] oldPriceValue=', oldPriceValue, ' oldPriceStyle=', oldPriceStyle);

            // Текст наличия
            const presenceText = prod.availability
                ? this.translations.inStock
                : this.translations.outOfStock;

            // Покажем шаблон до замен
            console.log('[DEBUG] BEFORE replacements:\n', productTemplate);

            // Делаем подстановки — обращайте внимание, 
            // какие именно плейсхолдеры есть в productTemplate ({{imageUrl}}, {{name}}, и т.д.)
            let pHtml = productTemplate;
            pHtml = safeReplace(pHtml, 'labelBlock', labelHtml);
            pHtml = safeReplace(pHtml, 'name', escapeHtml(prod.name ?? 'No Name'));
            pHtml = safeReplace(pHtml, 'price', String(prod.newPrice ?? '???'));
            pHtml = safeReplace(pHtml, 'currencyId', escapeHtml(prod.currencyId ?? '???'));
            pHtml = safeReplace(pHtml, 'presence', escapeHtml(presenceText));
            pHtml = safeReplace(pHtml, 'oldPrice', String(oldPriceValue));
            pHtml = safeReplace(pHtml, 'oldPriceStyle', oldPriceStyle);
            // ВАЖНО: не забудьте подставить картинку, если есть плейсхолдер {{imageUrl}}
            pHtml = safeReplace(pHtml, 'imageUrl', escapeHtml(prod.imageUrl ?? ''));

            console.log('[DEBUG] AFTER replacements:\n', pHtml);

            // Создаем DOM-элемент
            const wrapperEl = document.createElement('div');
            wrapperEl.innerHTML = pHtml.trim();

            // Ссылка
            const linkWrap = document.createElement('a');
            linkWrap.href = prod.url || '#';
            linkWrap.target = '_blank';
            linkWrap.className = 'product-link';

            // Если нет в наличии
            if (!prod.availability) {
                linkWrap.classList.add('out-of-stock');
            }

            // Добавляем
            linkWrap.appendChild(wrapperEl.firstElementChild);
            productContainer.appendChild(linkWrap);
        });

        // Ещё...
        if (items.length > limitCount && !isSingle) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'more-link';
            moreDiv.textContent = `${this.translations.more} ${items.length - limitCount} ...`;
            moreDiv.addEventListener('click', () => {
                console.log('[LOG:renderSingleCategoryBlock] More clicked. catName=', catName);
                const singleObj = { [catName]: sorted };
                this.showCategoryProducts(singleObj, [catName], resultContainer, true, catName);
                this.activateCategory(catName);
            });
            productContainer.appendChild(moreDiv);
        }

        catBlock.appendChild(productContainer);
        resultContainer.appendChild(catBlock);
        console.log('[DEBUG] Appended catBlock for', catName, 'with', subset.length, 'items');
    }






    async fetchInterfaceLanguage(domainPath) {
        try {
            const resp = await fetch(this.languageRoute, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ domain: domainPath }),
            });
            if (!resp.ok) {
                console.warn('[WARN] Language route not OK => use default...');
                return null;
            }
            const data = await resp.json();
            if (!data.success) {
                console.warn('[WARN] Language route success=false => default...');
                return null;
            }
            console.log('[DEBUG] language from route:', data.language);
            return data.language || null;
        } catch (err) {
            console.error('[ERROR] fetchInterfaceLanguage:', err);
            return null;
        }
    }

    applyTranslations(langCode) {
        if (this.translationsMap[langCode]) {
            console.log('[DEBUG] Found translations for', langCode);
            this.translations = this.translationsMap[langCode];
        } else {
            console.log('[DEBUG] No translations for', langCode, '=> keep default.');
        }
    }

    async saveSearchQuery(query) {
        if (!this.userId || !query) return;
        try {
            // Берем домен:
            const fullPathNoQuery = window.location.origin + window.location.pathname;
            // Или, если нужно, полный путь без query:
            // const domain = window.location.origin + window.location.pathname;

            const resp = await fetch('https://smartsearch.spefix.com/api/addSearchQuery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    query: query,
                    domain: fullPathNoQuery    // <-- добавили поле domain
                })
            });
            console.log('[LOG:saveSearchQuery] status=', resp.status);
        } catch (err) {
            console.error('[LOG:saveSearchQuery] Error:', err);
        }
    }

    async saveWordsToDatabase(query) {
        if (!query) return;
        try {
            const r = await fetch('https://smartsearch.spefix.com/api/save-words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: query })
            });
            console.log('[LOG:saveWordsToDatabase] status=', r.status);
        } catch (err) {
            console.error('[LOG:saveWordsToDatabase] Error:', err);
        }
    }
}

// Функция для экранирования HTML-опасных символов
function escapeHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Универсальная функция для безопасной подстановки в шаблон
function safeReplace(str, placeholder, replacement) {
    // Если нужно экранировать, включаем escapeHtml
    // но, например, для {{labelBlock}} (где уже есть готовый HTML) 
    // можно не экранировать. Решите, где именно нужно экранировать.
    const safe = replacement ?? ''; // здесь можно при желании вызывать escapeHtml(someValue)
    // Делаем глобальную замену плейсхолдера:
    const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
    return str.replace(regex, safe);
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded');
    new ProductSearchWidget('searchInput');
});
