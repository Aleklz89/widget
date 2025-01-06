class ProductSearchWidget {
    constructor(triggerInputId) {
        console.log('[LOG:constructor] Initializing with triggerInputId:', triggerInputId);
        this.triggerInputId = triggerInputId;


        this.apiUrl = 'http://localhost:3000/api/search';
        this.suggestionsUrl = 'https://smartsearch.spefix.com/api/suggestions';
        this.correctionUrl = 'https://smartsearch.spefix.com/api/correct';
        this.languageRoute = 'https://smartsearch.spefix.com/api/language';


        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.siteDomain = window.location.origin + window.location.pathname;
        this.allProducts = [];
        this.activeFilters = {};


        this.maxItemsOnAllResults = 4;


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


        const userLang = await this.fetchInterfaceLanguage(this.siteDomain);
        console.log("Язык пользователя:", userLang)
        if (userLang) {
            this.applyTranslations(userLang);
        }



        const resp = await fetch('https://aleklz89.github.io/widget/widget.html');
        const widgetHtml = await resp.text();


        const tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = widgetHtml.trim();
        this.widgetContainer = tmpDiv.firstElementChild;
        document.body.appendChild(this.widgetContainer);


        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap';
        document.head.appendChild(fontLink);


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

            document.head.appendChild(link);
        });


        const styleTag = document.createElement('style');
        styleTag.textContent = `
        
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


        const triggers = document.querySelectorAll(`#${this.triggerInputId}`);
        if (!triggers.length) {
            console.error('[LOG:initWidget] No triggers found');
            return;
        }
        triggers.forEach((inp) => this.setupEventHandlers(this.widgetContainer, inp));


        await this.getOrCreateUserId();
        await this.loadSearchHistory(this.userId);
        this.updateSearchHistory();
        this.addHistoryPopupHandlers();

        this.createCategoryAccordion();

        this.createFilterAccordion();


        this.adjustDefaultPanels();
        await this.incrementPageView();
    }

    adjustDefaultPanels() {
        console.log('[LOG:adjustDefaultPanels] Start.');


        const currentWidth = window.innerWidth;
        console.log('[LOG:adjustDefaultPanels] window.innerWidth=', currentWidth);


        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const catAccordion = this.widgetContainer.querySelector('.category-accordion');


        console.log('[LOG:adjustDefaultPanels] filterContainer=', filterContainer);
        console.log('[LOG:adjustDefaultPanels] catAccordion=', catAccordion);

        if (!filterContainer || !catAccordion) {
            console.warn('[LOG:adjustDefaultPanels] filterContainer or catAccordion not found => return');
            return;
        }


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

    createCategoryAccordion() {
        console.log('[LOG:createCategoryAccordion] Creating category accordion block...');

        const leftCol = this.widgetContainer.querySelector('.left-column');
        const catsContainer = this.widgetContainer.querySelector('.categories-container');
        if (!leftCol || !catsContainer) {
            console.warn('[LOG:createCategoryAccordion] No .left-column or .categories-container found.');
            return;
        }

        const catAccordion = document.createElement('div');
        catAccordion.className = 'category-accordion collapsed';

        const catHeader = document.createElement('div');
        catHeader.className = 'category-accordion-header';
        catHeader.textContent = `${this.translations.categories} ▼`;

        catHeader.addEventListener('click', () => {
            catAccordion.classList.toggle('collapsed');
            if (catAccordion.classList.contains('collapsed')) {
                catHeader.textContent = `${this.translations.categories} ▼`;
            } else {
                catHeader.textContent = `${this.translations.categories} ▲`;
            }
        });

        const catContent = document.createElement('div');
        catContent.className = 'category-accordion-content';


        catContent.appendChild(catsContainer);
        catAccordion.appendChild(catHeader);
        catAccordion.appendChild(catContent);


        leftCol.appendChild(catAccordion);


        console.log('[LOG:createCategoryAccordion] Category accordion appended to .left-column');
    }

    createFilterAccordion() {
        console.log('[LOG:createFilterAccordion] Inserting filter panel');

        const leftCol = this.widgetContainer.querySelector('.left-column');
        if (!leftCol) {
            console.warn('[LOG:createFilterAccordion] .left-column not found => cannot insert filters');
            return;
        }

        const filterContainer = document.createElement('div');
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



        leftCol.appendChild(filterContainer);
        console.log('[LOG:createFilterAccordion] Filter panel appended to .left-column');
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

        const paramNames = Object.keys(filterData);

        if (!paramNames.length) {
            console.log('[LOG:buildFilterMenu] No filters => hide filterContainer.');
            filterContainer.style.display = 'none';
            this.hasFilters = false;
            return;
        }

        filterContainer.style.display = 'flex';
        this.hasFilters = true;

        paramNames.forEach((paramName) => {
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

                checkbox.addEventListener('change', async () => {
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


                    try {
                        await fetch('https://smartsearch.spefix.com/api/filter-operation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                domain: this.siteDomain,
                                filterName: paramName,
                                value: val,
                                isChecked: checkbox.checked
                            })
                        });
                    } catch (error) {
                        console.error('[LOG:filter-operation] Error calling /api/filter-operation:', error);
                    }


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

        // 1. Находим важные элементы
        const sInput = widgetContainer.querySelector('.widget-search-input');
        const cButton = widgetContainer.querySelector('.widget-close-button');
        const catsCont = widgetContainer.querySelector('.categories-container');
        const resCont = widgetContainer.querySelector('.widget-result-container');
        const suggList = widgetContainer.querySelector('.widget-suggestions-list');

        // Допустим, ваш HTML содержит что-то вроде <div class="widget-search-icon"></div>
        // — добавим обработчик, чтобы при клике запустить поиск:
        const searchIcon = widgetContainer.querySelector('.widget-search-icon');

        // 2. Клик по кнопке «закрыть» виджет
        cButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
        });

        // 3. При фокусе на triggerInput (внешний инпут, который открывает виджет)
        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            sInput.focus();
            const q = sInput.value.trim();
            if (!q) {
                this.showHistory();
            } else {
                this.hideHistory();
            }
        });

        // 4. Основной обработчик ввода (в виджетном инпуте sInput)
        sInput.addEventListener('input', async (e) => {
            let query = e.target.value;
            const reqToken = Symbol('requestToken');
            this.currentRequestToken = reqToken;

            // Если пользователь поставил пробел в конце — пытаемся исправить опечатку
            const last = query.slice(-1);
            if (last === ' ') {
                query = query.trimEnd();
                await this.correctQuery(query, sInput);
                query = sInput.value;
                this.currentQuery = query;
            }

            // Если пустой запрос — показываем историю, скрываем список подсказок
            if (!query.trim()) {
                this.showHistory();
                suggList.style.display = 'none';
                return;
            } else {
                this.hideHistory();
            }

            // Прерываем предыдущий запрос (abortController) при новом вводе
            if (this.abortController) this.abortController.abort();
            this.abortController = new AbortController();
            const controller = this.abortController;

            // Если всего 1 символ или вообще ничего — пока не даём подсказок
            if (query.trim().length < 1) {
                suggList.innerHTML = '';
                suggList.style.display = 'none';
                return;
            }

            try {
                // 1) Подгружаем подсказки
                await this.fetchSuggestions(query.trim(), suggList, sInput, reqToken, controller);
                // 2) Если длина >= 3, параллельно ищем товары
                if (query.trim().length >= 3) {
                    await this.fetchProducts(query.trim(), catsCont, resCont, reqToken, controller);
                } else {
                    // Мало символов => просто "Начните поиск..."
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

        // 5. Обработчик нажатия Enter
        sInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                const query = sInput.value.trim();
                if (!query) {
                    console.log('[LOG] Enter pressed, but query is empty => do nothing');
                    return;
                }

                console.log('[LOG] Enter pressed => force search with query=', query);

                // Попытка исправить опечатки перед поиском
                await this.correctQuery(query, sInput);

                try {
                    const reqToken = Symbol('requestToken');
                    this.currentRequestToken = reqToken;

                    if (this.abortController) this.abortController.abort();
                    this.abortController = new AbortController();

                    if (query.length >= 1) {
                        const catsCont = widgetContainer.querySelector('.categories-container');
                        const resCont = widgetContainer.querySelector('.widget-result-container');
                        await this.fetchProducts(query, catsCont, resCont, reqToken, this.abortController);
                    }
                } catch (err) {
                    console.error('[LOG:Enter Search] Error:', err);
                }
            }
        });

        // 6. Если лупа (иконка) есть в HTML, при клике тоже запускаем поиск
        if (searchIcon) {
            searchIcon.addEventListener('click', async () => {
                const query = sInput.value.trim();
                if (!query) {
                    console.log('[LOG] searchIcon clicked, but query is empty => do nothing');
                    return;
                }

                console.log('[LOG] searchIcon clicked => force search with query=', query);

                // Попытка исправить опечатки перед поиском
                await this.correctQuery(query, sInput);

                try {
                    const reqToken = Symbol('requestToken');
                    this.currentRequestToken = reqToken;

                    if (this.abortController) this.abortController.abort();
                    this.abortController = new AbortController();

                    if (query.length >= 1) {
                        await this.fetchProducts(query, catsCont, resCont, reqToken, this.abortController);
                    }
                } catch (err) {
                    console.error('[LOG:searchIcon] Error:', err);
                }
            });
        }

        // 7. Закрываем выпадающий список подсказок, если кликнули вне него
        document.addEventListener('click', (evt) => {
            if (suggList && !suggList.contains(evt.target) && evt.target !== sInput) {
                suggList.style.display = 'none';
            }
        });
    }

    async getOrCreateUserId() {
        if (!window.Cookies) await this.loadJsCookieLibrary();



        const domain = window.location.hostname || 'unknown-domain';

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


            if (this.searchHistory.length && !sInp.value.trim()) {
                this.showHistory();
            } else {
                this.hideHistory();
            }
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

        const suggestionsArray = data.suggestions;
        if (!Array.isArray(suggestionsArray) || !suggestionsArray.length) {
            console.log('[LOG:fetchSuggestions] Нет массива строк => скрываем подсказки');
            suggestionsList.style.display = 'none';
            return;
        }


        const filtered = suggestionsArray.filter(
            (s) => s.trim().toLowerCase() !== query.trim().toLowerCase()
        );

        if (!filtered.length) {
            suggestionsList.style.display = 'none';
            return;
        }

        suggestionsList.innerHTML = '';

        filtered.forEach((suggText) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';


            const boldText = suggText.replace(query, '');
            item.innerHTML = `<span>${query}</span><strong>${boldText}</strong>`;


            item.addEventListener('click', async () => {

                searchInput.value = suggText;
                searchInput.dispatchEvent(new Event('input'));


                try {
                    await fetch('https://smartsearch.spefix.com/api/hint-click', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            hint: suggText,
                            domain: this.siteDomain,
                        }),
                    });
                } catch (err) {
                    console.error('[LOG:hint-click] Error:', err);
                }
            });

            suggestionsList.appendChild(item);
        });

        suggestionsList.style.display = 'flex';
    }

    async correctQuery(word, searchInput) {
        console.log('[LOG:correctQuery] word=', word);

        try {

            const requestBody = {
                word,
                domain: this.siteDomain,
            };

            const r = await fetch(this.correctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
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

    async incrementPageView() {
        console.log('[LOG:incrementPageView] Sending page view to server...');
        try {
            const resp = await fetch('https://smartsearch.spefix.com/api/add-page-view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: this.siteDomain,
                }),
            });
            if (!resp.ok) {
                console.warn('[LOG:incrementPageView] Response not OK:', resp.status);
            } else {
                console.log('[LOG:incrementPageView] Page view incremented successfully.');
            }
        } catch (err) {
            console.error('[LOG:incrementPageView] Error:', err);
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


        const leftCol = this.widgetContainer.querySelector('.left-column');

        if (!products.length) {

            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            categoriesContainer.innerHTML = '';


            if (leftCol) leftCol.style.display = 'none';
        } else {


            if (leftCol) leftCol.style.display = 'flex';

            this.buildFilterMenu();
            const filtered = this.applyActiveFilters(products);
            this.displayProductsByCategory(filtered, categoriesContainer, resultContainer);

            await this.saveSearchQuery(query);
            await this.saveWordsToDatabase(query);
        }
    }

    displayProductsByCategory(products, categoriesContainer, resultContainer) {
        console.log('[LOG:displayProductsByCategory] products.length=', products.length);

        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const catAccordion = this.widgetContainer.querySelector('.category-accordion');


        categoriesContainer.innerHTML = '';
        resultContainer.innerHTML = '';


        if (!products.length) {
            // Показываем "товаров не найдено"
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;

            // 1. Если фильтров нет (this.hasFilters = false) — скрываем левую колонку
            //    Иначе оставляем панель фильтров
            if (!this.hasFilters) {
                if (filterContainer) filterContainer.style.display = 'none';
                if (catAccordion) catAccordion.style.display = 'none';
                // Можно скрыть и .left-column целиком, если хотите
                if (leftCol) leftCol.style.display = 'none';
            } else {
                // Есть фильтры => оставляем панель,
                // чтобы пользователь мог снять галочки.
                if (filterContainer) filterContainer.style.display = 'flex';
                if (catAccordion) catAccordion.style.display = 'none';
                // Категории имеет смысл скрыть, т.к. всё равно ничего нет,
                // но фильтры должны оставаться.
                if (leftCol) leftCol.style.display = 'flex';
            }
            return;
        }


        if (!this.hasFilters) {
            console.log('[LOG:displayProductsByCategory] hasFilters=false => скрываем filterContainer');
            if (filterContainer) filterContainer.style.display = 'none';
        } else {
            console.log('[LOG:displayProductsByCategory] hasFilters=true => показываем filterContainer');
            if (filterContainer) filterContainer.style.display = 'flex';
        }


        const uniqueProducts = [];
        const usedIds = new Set();

        for (const p of products) {
            if (!usedIds.has(p.id)) {
                uniqueProducts.push(p);
                usedIds.add(p.id);
            } else {
                console.log('[LOG:displayProductsByCategory] Duplicate removed:', {
                    id: p.id,
                    name: p.name
                });
            }
        }
        console.log(`[LOG:displayProductsByCategory] After dedup => uniqueProducts.length=${uniqueProducts.length}`);


        const catMap = {};
        uniqueProducts.forEach((p) => {
            if (!p.categories) return;
            p.categories.forEach((cat) => {
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(p);
            });
        });


        const catMapNoDupes = {};
        for (const catName in catMap) {
            const arr = catMap[catName];
            const localSet = new Set();
            const filtered = [];
            for (const prod of arr) {
                if (!localSet.has(prod.id)) {
                    localSet.add(prod.id);
                    filtered.push(prod);
                }
            }
            catMapNoDupes[catName] = filtered;
        }


        let catNames = Object.keys(catMapNoDupes);
        if (!catNames.length) {
            console.log('[LOG:displayProductsByCategory] Нет категорий => скрыть catAccordion');
            if (catAccordion) catAccordion.style.display = 'none';
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            return;
        } else {
            console.log('[LOG:displayProductsByCategory] Есть категории => показываем catAccordion');
            if (catAccordion) catAccordion.style.display = 'flex';
        }


        const categoryScores = {};
        Object.entries(catMapNoDupes).forEach(([catName, items]) => {

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


        catNames.sort((a, b) => (categoryScores[b] || 0) - (categoryScores[a] || 0));


        const allResultsName = this.translations.allResults || 'All results';
        const finalCats = [allResultsName, ...catNames];

        console.log('[DEBUG-catScore] Итоговый порядок категорий:', finalCats);


        finalCats.forEach((catName) => {
            const cItem = document.createElement('div');
            cItem.className = 'category-item';

            let displayName = catName;
            if (displayName.length > 22) {
                displayName = displayName.substring(0, 22) + '...';
            }

            const cText = document.createElement('span');
            cText.className = 'category-name';
            cText.textContent = displayName;

            const cCount = document.createElement('div');
            cCount.className = 'category-count';


            if (catName === allResultsName) {
                cCount.textContent = uniqueProducts.length;
            } else {
                cCount.textContent = catMapNoDupes[catName].length;
            }

            cItem.appendChild(cText);
            cItem.appendChild(cCount);


            cItem.addEventListener('click', () => {
                Array.from(categoriesContainer.getElementsByClassName('category-item'))
                    .forEach((el) => el.classList.remove('active'));
                cItem.classList.add('active');

                if (catName === allResultsName) {

                    this.showCategoryProducts(catMapNoDupes, finalCats, resultContainer, true, null);
                } else {

                    const singleObj = { [catName]: catMapNoDupes[catName] };
                    this.showCategoryProducts(singleObj, [catName], resultContainer, true, catName);
                }
            });

            categoriesContainer.appendChild(cItem);
        });


        const firstItem = categoriesContainer.querySelector('.category-item');
        if (firstItem) firstItem.classList.add('active');


        this.showCategoryProducts(catMapNoDupes, finalCats, resultContainer, true, null);
    }



    async showCategoryProducts(
        groupedProducts,
        finalCategoryNames,
        resultContainer,
        showTitles = true,
        selectedCat = null
    ) {
        console.log('[LOG:showCategoryProducts] selectedCat=', selectedCat);

        const isAllResults = (selectedCat === null);


        resultContainer.innerHTML = '';


        const tResp = await fetch('https://aleklz89.github.io/widget/product-item.html');
        if (!tResp.ok) {
            throw new Error(`Failed to load product template: ${tResp.status}`);
        }
        const productTemplate = await tResp.text();


        if (isAllResults) {

            const realCats = finalCategoryNames.filter(
                (catName) => catName !== this.translations.allResults
            );



            const catData = [];



            const usedSet = new Set();


            for (const catName of realCats) {
                const allItems = groupedProducts[catName] || [];
                if (!allItems.length) {

                    catData.push({ catName, top4: [], score: 0, finalItems: [] });
                    continue;
                }


                const inStock = allItems.filter((p) => p.availability);
                const outStock = allItems.filter((p) => !p.availability);




                function compareByScoreAndDate(a, b) {

                    if (b.totalScore !== a.totalScore) {
                        return b.totalScore - a.totalScore;
                    }

                    const dateA = new Date(a.createdAt).getTime();
                    const dateB = new Date(b.createdAt).getTime();
                    return dateB - dateA;
                }
                inStock.sort(compareByScoreAndDate);
                outStock.sort(compareByScoreAndDate);


                const sortedItems = [...inStock, ...outStock];


                const top4 = [];
                for (const item of sortedItems) {
                    if (usedSet.has(item.id)) {

                        continue;
                    }
                    top4.push(item);
                    if (top4.length >= 4) break;
                }


                let score = 0;
                top4.forEach((prod) => {

                    score += prod.availability ? 1 : -1;
                });

                console.log(
                    `[LOG:showCategoryProducts] Cat="${catName}": totalItems=${allItems.length}, inStock=${inStock.length}, ` +
                    `top4.length=${top4.length}, score=${score}`
                );


                const top4Ids = top4.map((p) => p.id);
                console.log(`[DEBUG] Category="${catName}" => top4 IDs:`, top4Ids);


                top4.forEach((p) => usedSet.add(p.id));





                const finalItems = sortedItems.filter((itm) => {

                    if (top4.includes(itm)) return true;

                    return !usedSet.has(itm.id);
                });


                catData.push({
                    catName,
                    score,
                    top4,
                    finalItems
                });
            }


            catData.sort((a, b) => b.score - a.score);


            catData.forEach((catObj) => {
                const { catName, score, top4, finalItems } = catObj;



                if (!finalItems || finalItems.length === 0) {
                    console.log(`[LOG] Category="${catName}" => нет товаров => пропускаем`);
                    return;
                }



                const actuallyRendered = this.renderSingleCategoryBlock(
                    catName,
                    finalItems,
                    productTemplate,
                    resultContainer,
                    showTitles,
                    null,
                    4,
                    null
                );

                console.log(
                    `[LOG] Category="${catName}", rendered=${actuallyRendered.length}, score=${score}`
                );
            });
        }

        else {

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

    activateCategory(catName) {
        // Предположим, что в боковой панели у нас .categories-container > .category-item,
        // и внутри каждого .category-item есть .category-name c текстом
        const categoriesContainer = this.widgetContainer.querySelector('.categories-container');
        if (!categoriesContainer) return;

        // Снимаем класс active со всех
        const allCatItems = categoriesContainer.querySelectorAll('.category-item');
        allCatItems.forEach((el) => el.classList.remove('active'));

        // Ищем нужный блок по тексту внутри .category-name
        allCatItems.forEach((catItem) => {
            const catNameEl = catItem.querySelector('.category-name');
            if (!catNameEl) return;

            const text = catNameEl.textContent.trim();
            if (text === catName) {
                // Нашли совпадающую категорию => делаем active
                catItem.classList.add('active');
            }
        });
    }

    renderSingleCategoryBlock(
        catName,
        items,
        productTemplate,
        resultContainer,
        showTitles,
        selectedCat,
        limitCount,
        usedSet = null
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

        const possibleColors = ['#E91E63', '#2196F3', '#4CAF50', '#9C27B0', '#FF5722', '#FF9800'];


        const inS = items.filter((p) => p.availability);
        const outS = items.filter((p) => !p.availability);

        function sortByScoreAndDate(arr) {
            arr.sort((a, b) => {
                if (b.totalScore !== a.totalScore) {
                    return b.totalScore - a.totalScore;
                }
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA;
            });
        }

        sortByScoreAndDate(inS);
        sortByScoreAndDate(outS);

        let combined = [...inS, ...outS];

        if (usedSet) {
            combined = combined.filter((prod) => !usedSet.has(prod.id));
        }

        const subset = combined.slice(0, limitCount);

        if (!this.labelColorMap) {
            this.labelColorMap = {};
        }

        subset.forEach((prod, idx) => {
            console.log('[DEBUG] product item idx=', idx, ' data=', prod);


            let labelHtml = '';
            if (prod.label) {
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


            let oldPriceValue = '';
            let oldPriceStyle = 'display: none;';

            if (prod.oldPrice && prod.oldPrice > 0 && prod.oldPrice !== prod.newPrice) {
                oldPriceValue = `
                  <span style="white-space: nowrap;">
                    <span style="color: grey; font-size: 13px; text-decoration: line-through;">
                      ${prod.oldPrice} ${prod.currencyId ?? ''}
                    </span>
                    <span style="text-decoration: none;">&nbsp;&nbsp;</span>
                  </span>
                `.trim();
            } else {
                oldPriceValue = '';
            }
            console.log('[DEBUG] oldPriceValue=', oldPriceValue, ' oldPriceStyle=', oldPriceStyle);

            const presenceText = prod.availability
                ? this.translations.inStock
                : this.translations.outOfStock;

            const fallbackImageUrl = 'https://i.pinimg.com/564x/0c/bb/aa/0cbbaab0deff7f188a7762d9569bf1b3.jpg';
            const finalImageUrl = prod.image ? prod.image : fallbackImageUrl;

            let displayName = prod.name || 'No Name';
            if (displayName.length > 90) {
                displayName = displayName.slice(0, 90) + '...';
            }

            console.log('[DEBUG] BEFORE replacements:\n', productTemplate);

            let pHtml = productTemplate;
            pHtml = safeReplace(pHtml, 'labelBlock', labelHtml);
            pHtml = safeReplace(pHtml, 'name', escapeHtml(displayName));
            pHtml = safeReplace(pHtml, 'price', String(prod.newPrice ?? '???'));
            pHtml = safeReplace(pHtml, 'currencyId', escapeHtml(prod.currencyId ?? '???'));
            pHtml = safeReplace(pHtml, 'presence', escapeHtml(presenceText));
            pHtml = safeReplace(pHtml, 'oldPrice', oldPriceValue);
            pHtml = safeReplace(pHtml, 'oldPriceStyle', oldPriceStyle);
            pHtml = safeReplace(pHtml, 'imageUrl', escapeHtml(finalImageUrl));

            console.log('[DEBUG] AFTER replacements:\n', pHtml);

            const wrapperEl = document.createElement('div');
            wrapperEl.innerHTML = pHtml.trim();


            const linkWrap = document.createElement('a');
            linkWrap.href = prod.url || '#';
            linkWrap.target = '_blank';
            linkWrap.className = 'product-link';


            linkWrap.addEventListener('click', async (evt) => {
                try {



                    await fetch('https://smartsearch.spefix.com/api/product-transition', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            domain: this.siteDomain,
                            productId: prod.id
                        }),
                    });
                } catch (err) {
                    console.error('[LOG:product-transition] Error:', err);
                }
            });


            if (!prod.availability) {
                linkWrap.classList.add('out-of-stock');
            }

            linkWrap.appendChild(wrapperEl.firstElementChild);
            productContainer.appendChild(linkWrap);
        });

        if (items.length > limitCount && !isSingle) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'more-link';
            moreDiv.textContent = `${this.translations.more} ${items.length - limitCount} ...`;

            moreDiv.addEventListener('click', () => {
                console.log('[LOG:renderSingleCategoryBlock] More clicked. catName=', catName);

                // Переходим в «одну» категорию
                const singleObj = { [catName]: combined };
                this.showCategoryProducts(singleObj, [catName], resultContainer, true, catName);

                // А теперь подсвечиваем ту же категорию и в боковой панели:
                this.activateCategory(catName);
            });

            productContainer.appendChild(moreDiv);
        }

        catBlock.appendChild(productContainer);
        resultContainer.appendChild(catBlock);

        console.log('[DEBUG] Appended catBlock for', catName, 'with', subset.length, 'items');
        return subset;
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

            const fullPathNoQuery = window.location.origin + window.location.pathname;



            const resp = await fetch('https://smartsearch.spefix.com/api/addSearchQuery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    query: query,
                    domain: fullPathNoQuery
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


function escapeHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}


function safeReplace(str, placeholder, replacement) {



    const safe = replacement ?? '';

    const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
    return str.replace(regex, safe);
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded');
    new ProductSearchWidget('searchInput');
});
