class ProductSearchWidget {
    constructor(triggerInputId) {
        console.log('[LOG:constructor] Initializing with triggerInputId:', triggerInputId);
        this.triggerInputId = triggerInputId;

     
        this.apiUrl = 'https://smartsearch.spefix.com/api/search';
        this.suggestionsUrl = 'https://smartsearch.spefix.com/api/suggestions';
        this.correctionUrl = 'https://smartsearch.spefix.com/api/correct';

       
        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.siteDomain = window.location.pathname;
        this.allProducts = [];
        this.activeFilters = {};

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

 
        const response = await fetch('https://aleklz89.github.io/widget/widget.html'); 
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
            // link.href = `${stylesheet}`;
            link.href = `https://aleklz89.github.io/widget/${stylesheet}`;
            document.head.appendChild(link);
        });

   
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            /* Общий контейнер левой колонки высотой 100% */
            .left-column {
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            /* Блок фильтров изначально на 50% высоты, но при сворачивании уменьшается */
            .filter-container {
                background: #f9f9f9;
                border: 1px solid #ddd;
                margin-bottom: 10px;
                height: 50%;          /* Высота в раскрытом состоянии */
                overflow-y: auto;
                transition: height 0.3s ease;
            }
            .filter-container.collapsed {
                height: 40px;        /* Когда свернули - 40px высоты, освобождая место */
            }
            .filter-toggle-btn {
                background: #eee;
                border: none;
                width: 100%;
                text-align: left;
                padding: 8px;
                cursor: pointer;
                font-weight: bold;
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

            /* Контейнер для "Категории" - аналогичный аккордеон */
            .category-accordion {
                background: #f9f9f9;
                border: 1px solid #ddd;
                flex: 1;                    /* Занимает оставшуюся высоту */
                display: flex;
                flex-direction: column;
                overflow: hidden;           /* Чтобы при сворачивании скрывать */
                transition: height 0.3s ease;
            }
            .category-accordion.collapsed {
                height: 40px;              /* При свёрнутом состоянии */
            }
            .category-accordion-header {
                background: #eee;
                padding: 8px;
                font-weight: bold;
                cursor: pointer;
                border-bottom: 1px solid #ddd;
                font-size: 13px;
            }
            .category-accordion-content {
                overflow-y: auto;          /* Прокрутка для списка категорий */
                flex: 1;                   /* чтобы занять всё пространство */
            }

            .categories-container {
                border: none;             /* поскольку теперь будет внутри .category-accordion-content */
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

  
        this.createFilterAccordion();

   
        this.createCategoryAccordion();
    }

    createFilterAccordion() {
        console.log('[LOG:createFilterAccordion] Inserting filter panel');

      
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-container collapsed';

     
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'filter-toggle-btn';
        toggleBtn.textContent = 'Фильтры ▼';
        toggleBtn.addEventListener('click', () => {
            filterContainer.classList.toggle('collapsed');
            if (filterContainer.classList.contains('collapsed')) {
                toggleBtn.textContent = 'Фильтры ▼';
            } else {
                toggleBtn.textContent = 'Фильтры ▲';
            }
        });

        const filterContent = document.createElement('div');
        filterContent.className = 'filter-content';

        filterContainer.appendChild(toggleBtn);
        filterContainer.appendChild(filterContent);


        const leftCol = this.widgetContainer.querySelector('.left-column');
        if (leftCol) {
            leftCol.insertBefore(filterContainer, leftCol.querySelector('.categories-container'));
            console.log('[LOG:createFilterAccordion] Filter panel inserted above .categories-container');
        } else {
            console.warn('[LOG:createFilterAccordion] .left-column not found, inserting at top.');
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

  
        const catAccordion = document.createElement('div');
        catAccordion.className = 'category-accordion collapsed';  // Свернуто по умолчанию

 
        const catHeader = document.createElement('div');
        catHeader.className = 'category-accordion-header';
        catHeader.textContent = 'Категории';
        catHeader.addEventListener('click', () => {
            catAccordion.classList.toggle('collapsed');
            if (catAccordion.classList.contains('collapsed')) {
                catHeader.textContent = 'Категории';
            } else {
                catHeader.textContent = 'Категории';
            }
        });

       
        const catContent = document.createElement('div');
        catContent.className = 'category-accordion-content';

   
        catContent.appendChild(catsContainer);


        catAccordion.appendChild(catHeader);
        catAccordion.appendChild(catContent);


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
                    const res  = this.widgetContainer.querySelector('.widget-result-container');
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
        const sInput  = widgetContainer.querySelector('.widget-search-input');
        const cButton = widgetContainer.querySelector('.widget-close-button');
        const catsCont = widgetContainer.querySelector('.categories-container');
        const resCont  = widgetContainer.querySelector('.widget-result-container');
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
                    resCont.innerHTML = '<p>Почніть пошук...</p>';
                    catsCont.innerHTML = '';
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('[LOG:setupEventHandlers] Request aborted.');
                } else {
                    console.error('[LOG:setupEventHandlers] Error:', err);
                    resCont.innerHTML = '<p>Виникла помилка під час пошуку.</p>';
                    suggList.innerHTML = '<p>Помилка отримання пропозицій</p>';
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
        let userId = Cookies.get('userId');
        if (!userId) {
            userId = Math.floor(Math.random() * 1e9).toString();
            Cookies.set('userId', userId, { expires: 365 });
        }
        this.userId = userId;
        console.log('[LOG:getOrCreateUserId] userId=', userId);
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
        console.log('[LOG:loadSearchHistory] userId=', userId);
        if (!userId) return;
        try {
            const r = await fetch('https://smartsearch.spefix.com/api/get-user-query', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId }),
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
            headers: {'Content-Type': 'application/json'},
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
                headers: {'Content-Type': 'application/json'},
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
            headers: {'Content-Type': 'application/json'},
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

        if (!products.length) {
            resultContainer.innerHTML = '<p>No products found.</p>';
            categoriesContainer.innerHTML = '';
        } else {

            this.buildFilterMenu();
    
            const filtered = this.applyActiveFilters(products);
    
            this.displayProductsByCategory(filtered, categoriesContainer, resultContainer);
        
            await this.saveSearchQuery(query);
            await this.saveWordsToDatabase(query);
        }
    }

 
    displayProductsByCategory(products, categoriesContainer, resultContainer) {
        console.log('[LOG:displayProductsByCategory] products.length=', products.length);
        categoriesContainer.innerHTML = '';
        resultContainer.innerHTML = '';

        if (!products.length) {
            resultContainer.innerHTML = '<p>No products found.</p>';
            return;
        }


        const catMap = {};
        products.forEach((p) => {
            p.categories.forEach((c) => {
                if (!catMap[c]) catMap[c] = [];
                catMap[c].push(p);
            });
        });
        const catNames = Object.keys(catMap);
        const allResults = 'Всі результати';
        const finalCats = [allResults, ...catNames];

        finalCats.forEach((catName) => {
            const cItem = document.createElement('div');
            cItem.className = 'category-item';

            const cText = document.createElement('span');
            cText.className = 'category-name';
            cText.textContent = catName;

            const cCount = document.createElement('div');
            cCount.className = 'category-count';
            if (catName === allResults) {
                cCount.textContent = products.length;
            } else {
                cCount.textContent = catMap[catName]?.length || 0;
            }

            cItem.appendChild(cText);
            cItem.appendChild(cCount);

            cItem.addEventListener('click', () => {
                Array.from(categoriesContainer.getElementsByClassName('category-item')).forEach((el) => el.classList.remove('active'));
                cItem.classList.add('active');

                if (catName === allResults) {
                    this.showCategoryProducts(catMap, finalCats, resultContainer, true, null);
                } else {
                    const singleObj = { [catName]: catMap[catName] };
                    this.showCategoryProducts(singleObj, [catName], resultContainer, true, catName);
                }
            });

            if (catName === allResults) {
                cItem.classList.add('active');
            }
            categoriesContainer.appendChild(cItem);
        });

  
        this.showCategoryProducts(catMap, finalCats, resultContainer, true, null);
    }

    async showCategoryProducts(groupedProducts, finalCategoryNames, resultContainer, showTitles = true, selectedCat = null) {
        console.log('[LOG:showCategoryProducts] selectedCat=', selectedCat);
        const isAll = (selectedCat === null);

        resultContainer.innerHTML = '';
        const tResp = await fetch('https://aleklz89.github.io/widget/product-item.html');
        if (!tResp.ok) throw new Error(`Failed to load product template: ${tResp.status}`);
        const productTemplate = await tResp.text();

        if (isAll) {
            finalCategoryNames.forEach((catName) => {
                if (catName === 'Всі результати') return;
                const items = groupedProducts[catName] || [];
                if (!items.length) return;
                this.renderSingleCategoryBlock(catName, items, productTemplate, resultContainer, showTitles, null);
            });
        } else {
            const catName = finalCategoryNames[0];
            const arr = groupedProducts[catName] || [];
            this.renderSingleCategoryBlock(catName, arr, productTemplate, resultContainer, showTitles, catName);
        }
    }

    renderSingleCategoryBlock(catName, items, productTemplate, resultContainer, showTitles, selectedCat) {
        console.log('[LOG:renderSingleCategoryBlock] catName=', catName, 'items.length=', items.length);
        const isSingle = (selectedCat === catName);

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

   
        const inS = items.filter((p) => p.availability);
        const outS = items.filter((p) => !p.availability);
        const sorted = [...inS, ...outS];

        sorted.forEach((prod) => {
            const presence = prod.availability ? 'В наявності' : 'Немає в наявності';
            let pHtml = productTemplate
                .replace(/\{\{imageUrl\}\}/g, prod.image || '')
                .replace(/\{\{name\}\}/g, prod.name || 'No Name')
                .replace(/\{\{price\}\}/g, prod.newPrice || 'Unavailable')
                .replace(/\{\{currencyId\}\}/g, prod.currencyId || 'USD')
                .replace(/\{\{presence\}\}/g, presence);

            const el = document.createElement('div');
            el.innerHTML = pHtml.trim();

            const linkWrap = document.createElement('a');
            linkWrap.href = prod.url || '#';
            linkWrap.target = '_blank';
            linkWrap.className = 'product-link';
            if (!prod.availability) {
                linkWrap.classList.add('out-of-stock');
            }
            linkWrap.appendChild(el.firstElementChild);
            productContainer.appendChild(linkWrap);
        });

        catBlock.appendChild(productContainer);
        resultContainer.appendChild(catBlock);
    }


    async saveSearchQuery(query) {
        if (!this.userId || !query) return;
        try {
            const resp = await fetch('https://smartsearch.spefix.com/api/addSearchQuery', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: this.userId, query })
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
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ text: query })
            });
            console.log('[LOG:saveWordsToDatabase] status=', r.status);
        } catch (err) {
            console.error('[LOG:saveWordsToDatabase] Error:', err);
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded');
    new ProductSearchWidget('searchInput');
});
