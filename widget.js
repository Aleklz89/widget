class ProductSearchWidget {
    constructor(triggerInputId) {

        this.triggerInputId = triggerInputId;


        this.apiUrl = 'https://smartsearch.spefix.com/api/search';
        this.suggestionsUrl = 'https://smartsearch.spefix.com/api/suggestions';
        this.correctionUrl = 'https://smartsearch.spefix.com/api/correct';
        this.languageRoute = 'https://smartsearch.spefix.com/api/language';


        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.siteDomain = window.location.origin;
        this.allProducts = [];
        this.activeFilters = {};

        this.overlayEl = document.createElement('div');
        this.overlayEl.className = 'widget-overlay';
        document.body.appendChild(this.overlayEl);


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



        const userLang = await this.fetchInterfaceLanguage(this.siteDomain);
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


        const currentWidth = window.innerWidth;


        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const catAccordion = this.widgetContainer.querySelector('.category-accordion');



        if (!filterContainer || !catAccordion) {
            return;
        }


        if (currentWidth < 1100) {
            filterContainer.classList.add('collapsed');
            catAccordion.classList.add('collapsed');
        } else {
            filterContainer.classList.remove('collapsed');
            catAccordion.classList.remove('collapsed');
        }
    }

    createCategoryAccordion() {

        const leftCol = this.widgetContainer.querySelector('.left-column');
        const catsContainer = this.widgetContainer.querySelector('.categories-container');
        if (!leftCol || !catsContainer) {
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


    }

    createFilterAccordion() {

        const leftCol = this.widgetContainer.querySelector('.left-column');
        if (!leftCol) {
            return;
        }

        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-container collapsed';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'filter-toggle-btn';
        toggleBtn.textContent = `${this.translations.filters} ▼`;

        toggleBtn.addEventListener('click', () => {
            filterContainer.classList.toggle('collapsed');

            const isCollapsedNow = filterContainer.classList.contains('collapsed');

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
    }

    buildFilterMenu() {
        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const filterContent = filterContainer?.querySelector('.filter-content');
        if (!filterContainer || !filterContent) {
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


        const sInput = widgetContainer.querySelector('.widget-search-input');
        const cButton = widgetContainer.querySelector('.widget-close-button');
        const catsCont = widgetContainer.querySelector('.categories-container');
        const resCont = widgetContainer.querySelector('.widget-result-container');
        const suggList = widgetContainer.querySelector('.widget-suggestions-list');



        const searchIcon = widgetContainer.querySelector('.widget-search-icon');


        cButton.addEventListener('click', () => {
            widgetContainer.style.display = 'none';
            this.overlayEl.style.display = 'none';
            document.body.style.overflow = '';


            const sInput = widgetContainer.querySelector('.widget-search-input');
            if (sInput) {
                sInput.value = '';
            }


            const resCont = widgetContainer.querySelector('.widget-result-container');
            if (resCont) {
                resCont.innerHTML = '';
            }


            const suggList = widgetContainer.querySelector('.widget-suggestions-list');
            if (suggList) {
                suggList.style.display = 'none';
                suggList.innerHTML = '';
            }

            const leftCol = this.widgetContainer.querySelector('.left-column');
            if (leftCol) {
                leftCol.style.display = 'none';
            }
        });

        triggerInput.addEventListener('focus', () => {
            widgetContainer.style.display = 'flex';
            this.overlayEl.style.display = 'block';
            document.body.style.overflow = 'hidden';
            sInput.focus();
            const q = sInput.value.trim();
            if (!q) {
                this.showHistory();
            } else {
                this.hideHistory();
            }
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
                } else {
                    console.error('[LOG:setupEventHandlers] Error:', err);
                    resCont.innerHTML = `<p>${this.translations.errorWhileSearch || 'Error in search...'}</p>`;
                    suggList.innerHTML = `<p>${this.translations.errorWhileSuggestions || 'Error in suggestions...'}</p>`;
                }
            }
        });


        sInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                const query = sInput.value.trim();
                if (!query) {
                    return;
                }



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


        if (searchIcon) {
            searchIcon.addEventListener('click', async () => {
                const query = sInput.value.trim();
                if (!query) {
                    return;
                }



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



                const textP = document.createElement('p');
                textP.textContent = q;


                item.addEventListener('click', () => {
                    const sIn = document.querySelector('.widget-search-input');
                    if (!sIn) return;
                    sIn.value = q;
                    sIn.dispatchEvent(new Event('input'));
                });


                item.appendChild(textP);


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

        const r = await fetch(this.suggestionsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, domain: this.siteDomain }),
            signal: controller.signal
        });
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);

        const data = await r.json();
        if (requestToken !== this.currentRequestToken) {
            return;
        }

        const suggestionsArray = data.suggestions;
        if (!Array.isArray(suggestionsArray) || !suggestionsArray.length) {
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
            }
        } catch (err) {
            console.error('[LOG:correctQuery] Error:', err);
        }
    }

    async incrementPageView() {
        try {
            const resp = await fetch('https://smartsearch.spefix.com/api/add-page-view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: this.siteDomain,
                }),
            });

        } catch (err) {
            console.error('[LOG:incrementPageView] Error:', err);
        }
    }

    async fetchProducts(query, categoriesContainer, resultContainer, requestToken, controller) {
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
            return;
        }
        if (!Array.isArray(products)) {
            return;
        }
        this.allProducts = products;


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

    async displayProductsByCategory(products, categoriesContainer, resultContainer) {
        const filterContainer = this.widgetContainer.querySelector('.filter-container');
        const catAccordion = this.widgetContainer.querySelector('.category-accordion');
        const leftCol = this.widgetContainer.querySelector('.left-column');


        categoriesContainer.innerHTML = '';
        resultContainer.innerHTML = '';


        if (!products.length) {
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;

            if (!this.hasFilters) {
                if (filterContainer) filterContainer.style.display = 'none';
                if (catAccordion) catAccordion.style.display = 'none';
                if (leftCol) leftCol.style.display = 'none';
            } else {

                if (filterContainer) filterContainer.style.display = 'flex';
                if (catAccordion) catAccordion.style.display = 'none';
                if (leftCol) leftCol.style.display = 'flex';
            }
            return;
        }


        if (!this.hasFilters) {
            if (filterContainer) filterContainer.style.display = 'none';
        } else {
            if (filterContainer) filterContainer.style.display = 'flex';
        }


        const uniqueProducts = [];
        const usedIdsGlobal = new Set();
        for (const p of products) {
            if (!usedIdsGlobal.has(p.id)) {
                uniqueProducts.push(p);
                usedIdsGlobal.add(p.id);
            }
        }


        const catMap = {};
        uniqueProducts.forEach((product) => {
            if (!product.categories) return;
            product.categories.forEach((catObj) => {
                const catName = catObj.name;
                const catUrl = catObj.url;
                if (!catMap[catName]) {
                    catMap[catName] = {
                        items: [],
                        url: catUrl
                    };
                }
                catMap[catName].items.push(product);
            });
        });


        const catMapNoDupes = {};
        for (const catName in catMap) {
            const arr = catMap[catName].items;
            const localSet = new Set();
            const filtered = [];
            for (const prod of arr) {
                if (!localSet.has(prod.id)) {
                    localSet.add(prod.id);
                    filtered.push(prod);
                }
            }

            catMapNoDupes[catName] = {
                items: filtered,
                url: catMap[catName].url
            };
        }

        let catNames = Object.keys(catMapNoDupes);


        if (!catNames.length) {
            if (catAccordion) catAccordion.style.display = 'none';
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            return;
        } else {
            if (catAccordion) catAccordion.style.display = 'flex';
        }


        const usedSet = new Set();
        const categoryScores = {};


        this.catAllItemsMap = {};
        this.catScoringSubsets = {};

        catNames.forEach((catName) => {
            const items = catMapNoDupes[catName].items;

            this.catAllItemsMap[catName] = items;


            const inStock = items.filter((x) => x.availability);
            const outStock = items.filter((x) => !x.availability);
            const sortedItems = [...inStock, ...outStock];


            const filteredItems = sortedItems.filter((p) => !usedSet.has(p.id));


            const subsetCount = Math.min(this.maxItemsOnAllResults, filteredItems.length);
            const subset = filteredItems.slice(0, subsetCount);



            let score = 0;
            subset.forEach((prd, idx) => {
                let productScore = 0;
                let reasons = [];


                if (prd.availability) {
                    productScore += 1;
                    reasons.push('+1 (товар в наличии)');
                } else {
                    productScore -= 1;
                    reasons.push('-1 (товар нет в наличии)');
                }


                const PLACEHOLDER_URL = 'https://i.pinimg.com/564x/0c/bb/aa/0cbbaab0deff7f188a7762d9569bf1b3.jpg';
                if (!prd.image || prd.image === PLACEHOLDER_URL) {
                    productScore -= 1;
                    reasons.push('-1 (нет реальной картинки)');
                }

                score += productScore;
             
            });

            categoryScores[catName] = score;


            this.catScoringSubsets[catName] = subset;


            subset.forEach((p) => usedSet.add(p.id));
        });


        catNames.sort((a, b) => (categoryScores[b] || 0) - (categoryScores[a] || 0));


        const allResultsName = this.translations.allResults || 'All results';
        const finalCats = [allResultsName, ...catNames];


        finalCats.forEach((catName) => {
            const cItem = document.createElement('div');
            cItem.className = 'category-item';


            cItem.dataset.catName = catName;

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
                cCount.textContent = catMapNoDupes[catName].items.length;
            }

            cItem.appendChild(cText);
            cItem.appendChild(cCount);


            cItem.addEventListener('click', async () => {

                Array.from(categoriesContainer.getElementsByClassName('category-item'))
                    .forEach((el) => el.classList.remove('active'));
                cItem.classList.add('active');

                if (catName === allResultsName) {
                    await this.renderAllCategories(finalCats, catMapNoDupes, resultContainer);
                } else {
                    const singleObj = { [catName]: catMapNoDupes[catName].items };
                    await this.renderAllCategories([catName], singleObj, resultContainer, true);
                }
            });

            categoriesContainer.appendChild(cItem);
        });


        const firstItem = categoriesContainer.querySelector('.category-item');
        if (firstItem) firstItem.classList.add('active');

        this.catMapNoDupes = catMapNoDupes;



        await this.renderAllCategories(finalCats, catMapNoDupes, resultContainer);


    }



    async renderAllCategories(
        categoryNames,
        groupedProducts,
        resultContainer,
        isSingle = false
    ) {


        resultContainer.innerHTML = '';


        if (isSingle) {
            resultContainer.classList.add('category');
        } else {
            resultContainer.classList.remove('category');
        }


        const tResp = await fetch('https://aleklz89.github.io/widget/product-item.html');
        if (!tResp.ok) {
            throw new Error(`Failed to load product template: ${tResp.status}`);
        }
        const productTemplate = await tResp.text();

        const allResultsName = this.translations.allResults || 'All results';
        const showingAllCats = !isSingle && categoryNames.includes(allResultsName);


        if (showingAllCats) {

            const realCats = categoryNames.filter((cn) => cn !== allResultsName);

            for (const catName of realCats) {

                const top4 = this.catScoringSubsets?.[catName] || [];


                const allItems = this.catAllItemsMap?.[catName] || [];


                if (!top4.length) {
                    continue;
                }


                this.renderCategoryBlock(
                    catName,
                    allItems,
                    top4,
                    productTemplate,
                    false,
                    resultContainer
                );
            }
        }
        else {

            for (const catName of categoryNames) {
                const arr = groupedProducts[catName] || [];
                if (!arr.length) continue;

                this.renderCategoryBlock(
                    catName,
                    arr,
                    arr,
                    productTemplate,
                    true,
                    resultContainer
                );
            }
        }
    }




    renderCategoryBlock(
        catName,
        allItems,
        top4,
        productTemplate,
        isSingleCat,
        resultContainer
    ) {


        const catBlock = document.createElement('div');
        catBlock.className = `category-block ${isSingleCat ? 'category-single' : 'category-multiple'}`;

        const allResultsName = this.translations.allResults || 'All results';
        let categoryUrl = '#';


        if (catName !== allResultsName && this.catMapNoDupes?.[catName]?.url) {
            categoryUrl = this.catMapNoDupes[catName].url;
        }

        const titleHtml = `
          <h3>
            <a href="${categoryUrl}" class="category-link" target="_blank">
              ${catName} →
            </a>
          </h3>
        `;
        catBlock.innerHTML = titleHtml;


        const productContainer = document.createElement('div');
        productContainer.className = 'product-container';
        catBlock.appendChild(productContainer);


        resultContainer.appendChild(catBlock);


        let itemsToRender;
        if (isSingleCat) {
            itemsToRender = allItems;
        } else {
            itemsToRender = top4;
        }


        if (!this.labelColorMap) {
            this.labelColorMap = {};
        }
        const possibleColors = ['#E91E63', '#2196F3', '#4CAF50', '#9C27B0', '#FF5722', '#FF9800'];
        const PLACEHOLDER_URL =
            'https://i.pinimg.com/564x/0c/bb/aa/0cbbaab0deff7f188a7762d9569bf1b3.jpg';


        const inStockWithImg = itemsToRender.filter(
            (p) => p.availability && p.image && p.image !== PLACEHOLDER_URL
        );
        const inStockNoImg = itemsToRender.filter(
            (p) => p.availability && (!p.image || p.image === PLACEHOLDER_URL)
        );
        const outStockWithImg = itemsToRender.filter(
            (p) => !p.availability && p.image && p.image !== PLACEHOLDER_URL
        );
        const outStockNoImg = itemsToRender.filter(
            (p) => !p.availability && (!p.image || p.image === PLACEHOLDER_URL)
        );


        const sortedItems = [
            ...inStockWithImg,
            ...inStockNoImg,
            ...outStockWithImg,
            ...outStockNoImg,
        ];


        sortedItems.forEach((prod) => {

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
            }


            const presenceText = prod.availability
                ? this.translations.inStock
                : this.translations.outOfStock;


            const finalImageUrl =
                prod.image && prod.image !== PLACEHOLDER_URL
                    ? prod.image
                    : PLACEHOLDER_URL;


            let displayName = prod.name || 'No Name';
            if (displayName.length > 90) {
                displayName = displayName.slice(0, 90) + '...';
            }


            let pHtml = productTemplate;
            pHtml = safeReplace(pHtml, 'labelBlock', labelHtml);
            pHtml = safeReplace(pHtml, 'name', escapeHtml(displayName));
            pHtml = safeReplace(pHtml, 'price', String(prod.newPrice ?? '???'));
            pHtml = safeReplace(pHtml, 'currencyId', escapeHtml(prod.currencyId ?? '???'));
            pHtml = safeReplace(pHtml, 'presence', escapeHtml(presenceText));
            pHtml = safeReplace(pHtml, 'oldPrice', oldPriceValue);
            pHtml = safeReplace(pHtml, 'oldPriceStyle', oldPriceStyle);
            pHtml = safeReplace(pHtml, 'imageUrl', escapeHtml(finalImageUrl));


            const wrapperEl = document.createElement('div');
            wrapperEl.innerHTML = pHtml.trim();

            const linkWrap = document.createElement('a');
            linkWrap.href = prod.url || '#';
            linkWrap.target = '_blank';
            linkWrap.className = 'product-link';


            linkWrap.addEventListener('click', async () => {
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


        const shownCount = sortedItems.length;
        const totalCount = allItems.length;
        if (!isSingleCat && totalCount > shownCount) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'more-link';
            moreDiv.textContent = `${this.translations.more} ${totalCount - shownCount} ...`;

            moreDiv.addEventListener('click', () => {

                const singleObj = { [catName]: allItems };
                this.renderAllCategories([catName], singleObj, resultContainer, true);


                this.activateCategory(catName);
            });
            productContainer.appendChild(moreDiv);
        }
    }

    activateCategory(catName) {
        const categoriesContainer = this.widgetContainer.querySelector('.categories-container');
        if (!categoriesContainer) return;

        const allCatItems = categoriesContainer.querySelectorAll('.category-item');
        allCatItems.forEach((el) => el.classList.remove('active'));

        allCatItems.forEach((catItem) => {

            if (catItem.dataset.catName === catName) {
                catItem.classList.add('active');
            }
        });
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
                return null;
            }
            const data = await resp.json();
            if (!data.success) {
                return null;
            }
            return data.language || null;
        } catch (err) {
            console.error('[ERROR] fetchInterfaceLanguage:', err);
            return null;
        }
    }

    applyTranslations(langCode) {
        if (this.translationsMap[langCode]) {
            this.translations = this.translationsMap[langCode];
        } else {
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
    new ProductSearchWidget('searchInput');
});
