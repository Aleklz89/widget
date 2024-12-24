class ProductSearchWidget {
    constructor(triggerInputId) {
        console.log('[LOG:constructor] Initializing with triggerInputId:', triggerInputId);
        this.triggerInputId = triggerInputId;


        this.apiUrl = 'https://smartsearch.spefix.com/api/search';
        this.suggestionsUrl = 'https://smartsearch.spefix.com/api/suggestions';
        this.correctionUrl = 'https://smartsearch.spefix.com/api/correct';
        this.languageRoute = 'https://smartsearch.spefix.com/api/language';


        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.siteDomain = window.location.pathname;
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
        if (userLang) {
            this.applyTranslations(userLang);
        }



        const resp = await fetch('widget.html');
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
            // link.href = `${stylesheet}`;
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

        // Переносим .categories-container внутрь аккордеона
        catContent.appendChild(catsContainer);
        catAccordion.appendChild(catHeader);
        catAccordion.appendChild(catContent);

        // **Просто** добавляем catAccordion в .left-column
        leftCol.appendChild(catAccordion);
        //                      ^^^^^^^^^^^
        // чтобы аккордеон категорий был первым (перед фильтрами)
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

        // **ТЕПЕРЬ** вставляем фильтры ПОСЛЕ категорий
        // Просто дополняем .left-column
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

        // Собираем данные для фильтров
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

        // Если совсем нет параметров => скрываем .filter-container и запоминаем флажок
        if (!paramNames.length) {
            console.log('[LOG:buildFilterMenu] No filters => hide filterContainer.');
            filterContainer.style.display = 'none';
            this.hasFilters = false;      // <-- флажок
            return;
        }

        // Иначе у нас есть параметры => показываем .filter-container
        filterContainer.style.display = 'flex';
        this.hasFilters = true;          // <-- флажок

        // Далее создаём чекбоксы
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
            // Показывать историю только если она есть
            // И значение инпута ПУСТОЕ
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

        // 1) Если нет товаров вообще
        if (!products.length) {
            if (filterContainer) filterContainer.style.display = 'none';
            if (catAccordion) catAccordion.style.display = 'none';
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            return;
        }

        // 2) Проверяем, есть ли вообще фильтры
        if (!this.hasFilters) {
            console.log('[LOG:displayProductsByCategory] hasFilters=false => скрываем filterContainer');
            if (filterContainer) filterContainer.style.display = 'none';
        } else {
            console.log('[LOG:displayProductsByCategory] hasFilters=true => показываем filterContainer');
            if (filterContainer) filterContainer.style.display = 'flex';
        }

        // 3) Формируем карту категорий
        const catMap = {};
        products.forEach((p) => {
            if (!p.categories) return;
            p.categories.forEach((cat) => {
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(p);
            });
        });

        // 4) Если categories вообще нет => прячем аккордеон
        const catNames = Object.keys(catMap);
        if (!catNames.length) {
            console.log('[LOG:displayProductsByCategory] Нет категорий => скрыть catAccordion');
            if (catAccordion) catAccordion.style.display = 'none';
            return;
        } else {
            console.log('[LOG:displayProductsByCategory] Есть категории => показываем catAccordion');
            if (catAccordion) catAccordion.style.display = 'flex';
        }

        // 5) Подсчитываем «очки» (score) для каждой категории
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

        // 6) Сортируем catNames по убыванию score
        catNames.sort((a, b) => (categoryScores[b] || 0) - (categoryScores[a] || 0));

        // 7) Вставляем «Всі результати» (или "Все результаты") в начало
        const allResultsName = this.translations.allResults || 'Всі результати';
        const finalCats = [allResultsName, ...catNames];
        console.log('[DEBUG-catScore] Итоговый порядок категорий:', finalCats);

        // 8) Рендерим список категорий
        finalCats.forEach((catName) => {
            const cItem = document.createElement('div');
            cItem.className = 'category-item';

            // Обрезаем текст категории до 22 символов, если он длиннее
            let displayName = catName;
            if (catName.length > 22) {
                // Логируем, что обрезаем
                console.log(`[LOG:displayProductsByCategory] Обрезаем категорию "${catName}" до 22 символов`);
                displayName = catName.substring(0, 22) + '...';
            } else {
                // Логируем, что не обрезаем
                console.log(`[LOG:displayProductsByCategory] Категория "${catName}" не обрезается (length <= 22)`);
            }

            const cText = document.createElement('span');
            cText.className = 'category-name';
            // Важно: используем displayName (обрезанную строку) для вывода
            cText.textContent = displayName;

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

            // Если это «Все результаты», делаем активным
            if (catName === allResultsName) {
                cItem.classList.add('active');
            }
            categoriesContainer.appendChild(cItem);
        });

        // 9) Сразу показываем «Всі результати»
        this.showCategoryProducts(catMap, finalCats, resultContainer, true, null);
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

        if (!tResp.ok) throw new Error(`Failed to load product template: ${tResp.status}`);
        const productTemplate = await tResp.text();


        if (isAllResults) {



            for (const catName of finalCategoryNames) {

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

        // 1) Формируем заголовок категории (если нужно)
        const isSingle = !!selectedCat;
        const categoryTitleHtml = (showTitles || selectedCat)
            ? `<h3><a href="#" class="category-link">${catName} →</a></h3>`
            : '';

        // 2) Создаем контейнер для категории
        const catBlock = document.createElement('div');
        catBlock.className = `category-block ${isSingle ? 'category-single' : 'category-multiple'}`;
        if (categoryTitleHtml) {
            catBlock.innerHTML = categoryTitleHtml;
        }

        // 3) Контейнер для товаров
        const productContainer = document.createElement('div');
        productContainer.className = 'product-container';

        // Список возможных цветов для лейбла
        const possibleColors = ['#E91E63', '#2196F3', '#4CAF50', '#9C27B0', '#FF5722', '#FF9800'];

        // -- ЛОГИКА СОРТИРОВКИ --
        // Сначала делим товары на inStock/outOfStock
        const inS = items.filter((p) => p.availability);
        const outS = items.filter((p) => !p.availability);

        // Сортируем обе группы по убыванию даты (новые → старые)
        inS.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        outS.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Объединяем: сначала inStock, потом outOfStock
        const sorted = [...inS, ...outS];

        // Обрезаем массив до limitCount (если нужно)
        const subset = sorted.slice(0, limitCount);

        // Если нет карты цветов лейблов – создаём
        if (!this.labelColorMap) {
            this.labelColorMap = {};
        }

        // 4) Рендерим товары
        subset.forEach((prod, idx) => {
            console.log('[DEBUG] product item idx=', idx, ' data=', prod);

            // Лейбл
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

            // Старая/новая цена
            let oldPriceValue = prod.oldPrice || '';
            let oldPriceStyle = 'display: none;';
            if (prod.oldPrice && prod.oldPrice > 0 && prod.oldPrice !== prod.newPrice) {
                oldPriceStyle = 'color: grey; font-size: 13px; text-decoration: line-through;';
            }
            console.log('[DEBUG] oldPriceValue=', oldPriceValue, ' oldPriceStyle=', oldPriceStyle);

            // Текст наличия
            const presenceText = prod.availability
                ? this.translations.inStock
                : this.translations.outOfStock;

            // Фолбэк для изображения, если поле пустое
            const fallbackImageUrl = 'https://i.pinimg.com/564x/0c/bb/aa/0cbbaab0deff7f188a7762d9569bf1b3.jpg';  // Замените на вашу заглушку
            const finalImageUrl = prod.image ? prod.image : fallbackImageUrl;

            // Показываем шаблон до замен
            console.log('[DEBUG] BEFORE replacements:\n', productTemplate);

            // Делаем подстановки в шаблон
            let pHtml = productTemplate;
            pHtml = safeReplace(pHtml, 'labelBlock', labelHtml);
            pHtml = safeReplace(pHtml, 'name', escapeHtml(prod.name ?? 'No Name'));
            pHtml = safeReplace(pHtml, 'price', String(prod.newPrice ?? '???'));
            pHtml = safeReplace(pHtml, 'currencyId', escapeHtml(prod.currencyId ?? '???'));
            pHtml = safeReplace(pHtml, 'presence', escapeHtml(presenceText));
            pHtml = safeReplace(pHtml, 'oldPrice', String(oldPriceValue));
            pHtml = safeReplace(pHtml, 'oldPriceStyle', oldPriceStyle);
            pHtml = safeReplace(pHtml, 'imageUrl', escapeHtml(finalImageUrl));

            console.log('[DEBUG] AFTER replacements:\n', pHtml);

            // Создаем DOM-элемент
            const wrapperEl = document.createElement('div');
            wrapperEl.innerHTML = pHtml.trim();

            // Обёртываем товар ссылкой
            const linkWrap = document.createElement('a');
            linkWrap.href = prod.url || '#';
            linkWrap.target = '_blank';
            linkWrap.className = 'product-link';

            // Если нет в наличии - добавляем класс
            if (!prod.availability) {
                linkWrap.classList.add('out-of-stock');
            }

            // Добавляем в контейнер
            linkWrap.appendChild(wrapperEl.firstElementChild);
            productContainer.appendChild(linkWrap);
        });

        // 5) Кнопка «Показать ещё…»
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

        // 6) Добавляем всё в общий контейнер
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
