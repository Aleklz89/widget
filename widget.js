class ProductSearchWidget {
    constructor(triggerInputId) {
        console.log('[LOG:constructor] Initializing with triggerInputId:', triggerInputId);
        this.triggerInputId = triggerInputId;

        // Эндпоинты
        this.apiUrl = 'http://localhost:3000/api/search';
        this.suggestionsUrl = 'https://smartsearch.spefix.com/api/suggestions';
        this.correctionUrl = 'https://smartsearch.spefix.com/api/correct';
        this.languageRoute = 'http://localhost:3000/api/language';  // <-- Вот здесь указываем наш роут

        // Состояние
        this.searchHistory = [];
        this.abortController = null;
        this.currentQuery = null;
        this.siteDomain = window.location.pathname;
        this.allProducts = [];
        this.activeFilters = {};

        // Сколько товаров показывать на вкладке «Всі результати»
        this.maxItemsOnAllResults = 4;

        // Тексты по умолчанию (например, русские)
        this.translations = {
            searchPlaceholder: 'Поиск...',
            allResults: 'Всі результати',
            filters: 'Фільтри',
            categories: 'Категорії',
            noProductsFound: 'No products found.',
            inStock: 'В наявності',
            outOfStock: 'Немає в наявності',
            startSearch: 'Почніть пошук...',
            more: 'Ще'
        };

        // Альтернативные переводы (примерно)
        // В реальном коде, возможно, всё сложнее (JSON, etc.)
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
                noProductsFound: 'Товарів не знайдено.',
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
                allResults: 'Wyniki ogólne',
                filters: 'Filtry',
                categories: 'Kategorie',
                noProductsFound: 'Brak produktów.',
                inStock: 'W magazynie',
                outOfStock: 'Brak w magazynie',
                startSearch: 'Zacznij szukać...',
                more: 'Więcej'
            },
            de: {
                searchPlaceholder: 'Suche...',
                allResults: 'Alle Ergebnisse',
                filters: 'Filter',
                categories: 'Kategorien',
                noProductsFound: 'Keine Produkte gefunden.',
                inStock: 'Auf Lager',
                outOfStock: 'Nicht auf Lager',
                startSearch: 'Fangen Sie an zu suchen...',
                more: 'Mehr'
            }
        };

        // Запускаем
        this.initWidget();
    }

    // -----------------------------------------------------------
    // 1) Определяем язык с сервера
    // -----------------------------------------------------------
    async fetchInterfaceLanguage(domainPath = '/') {
        try {
            // Делаем POST-запрос на this.languageRoute
            const resp = await fetch(this.languageRoute, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ domain: domainPath }),
            });

            if (!resp.ok) {
                console.warn('[WARN] Language route not OK. Using default...');
                return null;
            }

            const data = await resp.json();
            console.log('[LOG:fetchInterfaceLanguage] data=', data); // { success: true, language: 'xx' }
            if (!data.success) {
                console.warn('[WARN] Language route success=false, using default...');
                return null;
            }

            // Возвращаем "language", если есть
            return data.language || null;

        } catch (err) {
            console.error('[ERROR] Could not fetch language route:', err);
            return null;
        }
    }
    
    // Применяем переводы
    applyTranslations(langCode) {
        if (this.translationsMap[langCode]) {
            console.log(`[LOG:applyTranslations] Using lang="${langCode}" from translationsMap`);
            this.translations = this.translationsMap[langCode];
        } else {
            console.log(`[LOG:applyTranslations] No translations found for "${langCode}", using default..`);
        }
    }

    // -----------------------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ ВИДЖЕТА
    // -----------------------------------------------------------
    async initWidget() {
        console.log('[LOG:initWidget] Start.');

        // 1) Узнаём язык с сервера
        const userLang = await this.fetchInterfaceLanguage();
        if (userLang) {
            this.applyTranslations(userLang);
        }

        // 2) Загружаем HTML
        const resp = await fetch('widget.html');
        const widgetHtml = await resp.text();

        // 3) Создаём DOM-элемент
        const tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = widgetHtml.trim();
        this.widgetContainer = tmpDiv.firstElementChild;
        document.body.appendChild(this.widgetContainer);

        // 4) Подключаем шрифты
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap';
        document.head.appendChild(fontLink);

        // 5) Стили
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
            link.href = `${stylesheet}`;
            document.head.appendChild(link);
        });

        // Доп. стили
        const styleTag = document.createElement('style');
        styleTag.textContent = `
          .left-column {
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .filter-container {
            background: #f9f9f9;
            border: 1px solid #ddd;
            margin-bottom: 10px;
            height: 50%;
            overflow-y: auto;
            transition: height 0.3s ease;
          }
          .filter-container.collapsed {
            height: 40px;
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

          /* Аккордеон категорий */
          .category-accordion {
            background: #f9f9f9;
            border: 1px solid #ddd;
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: height 0.3s ease;
          }
          .category-accordion.collapsed {
            height: 40px;
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
            overflow-y: auto;
            flex: 1;
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

        // 6) Ищем триггеры
        const triggers = document.querySelectorAll(`#${this.triggerInputId}`);
        if (!triggers.length) {
            console.error('[LOG:initWidget] No triggers found');
            return;
        }
        triggers.forEach((inp) => this.setupEventHandlers(this.widgetContainer, inp));

        // 7) userId + история
        await this.getOrCreateUserId();
        await this.loadSearchHistory(this.userId);
        this.updateSearchHistory();
        this.addHistoryPopupHandlers();

        // 8) Панели фильтров и категорий
        this.createFilterAccordion();
        this.createCategoryAccordion();
    }

    createFilterAccordion() {
        console.log('[LOG:createFilterAccordion] Inserting filter panel');
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-container collapsed';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'filter-toggle-btn';
        toggleBtn.textContent = `${this.translations.filters} ▼`;
        toggleBtn.addEventListener('click', () => {
            filterContainer.classList.toggle('collapsed');
            if (filterContainer.classList.contains('collapsed')) {
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
        if (leftCol) {
            leftCol.insertBefore(filterContainer, leftCol.querySelector('.categories-container'));
        } else {
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
        catAccordion.className = 'category-accordion collapsed';

        const catHeader = document.createElement('div');
        catHeader.className = 'category-accordion-header';
        catHeader.textContent = this.translations.categories;
        catHeader.addEventListener('click', () => {
            catAccordion.classList.toggle('collapsed');
            if (catAccordion.classList.contains('collapsed')) {
                catHeader.textContent = this.translations.categories;
            } else {
                catHeader.textContent = this.translations.categories;
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
        if (!filterContainer || !filterContent) return;

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
        sInput.placeholder = this.translations.searchPlaceholder; // <-- placeholder на языке
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
                headers: { 'Content-Type': 'application/json' },
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

        if (!products.length) {
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
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
            resultContainer.innerHTML = `<p>${this.translations.noProductsFound}</p>`;
            return;
        }

        const catMap = {};
        products.forEach((p) => {
            if (!p.categories) return;
            p.categories.forEach((cat) => {
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(p);
            });
        });

        // Логика подсчёта очков
        const categoryScores = {};
        Object.entries(catMap).forEach(([catName, items]) => {
            // Сортируем: inStock->outOfStock
            const inS = items.filter((x) => x.availability);
            const outS = items.filter((x) => !x.availability);
            const sorted = [...inS, ...outS];
            // первые 4
            const subset = sorted.slice(0, this.maxItemsOnAllResults);
            // считаем score
            let score = 0;
            subset.forEach((x) => {
                if (x.availability) {
                    score += 1;
                } else {
                    score -= 1;
                }
            });
            categoryScores[catName] = score;
            console.log(`[DEBUG-catScore] cat="${catName}", score=${score}, subsetLength=${subset.length}`);
        });

        // Сортируем по score (убывание)
        const catNames = Object.keys(catMap);
        catNames.sort((a, b) => (categoryScores[b] || 0) - (categoryScores[a] || 0));

        const allResults = this.translations.allResults || 'Всі результати';
        const finalCats = [allResults, ...catNames];

        // Рендер
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
                cCount.textContent = catMap[catName].length;
            }

            cItem.appendChild(cText);
            cItem.appendChild(cCount);

            cItem.addEventListener('click', () => {
                Array.from(categoriesContainer.getElementsByClassName('category-item'))
                    .forEach((el) => el.classList.remove('active'));
                cItem.classList.add('active');

                if (catName === allResults) {
                    // все
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

        // Показываем «Всі результати» (или "All results")
        this.showCategoryProducts(catMap, finalCats, resultContainer, true, null);
    }

    async showCategoryProducts(groupedProducts, finalCategoryNames, resultContainer, showTitles = true, selectedCat = null) {
        console.log('[LOG:showCategoryProducts] selectedCat=', selectedCat);
        const isAllResults = (selectedCat === null);

        resultContainer.innerHTML = '';
        const tResp = await fetch('https://aleklz89.github.io/widget/product-item.html');
        if (!tResp.ok) {
            throw new Error(`Failed to load product template: ${tResp.status}`);
        }
        const productTemplate = await tResp.text();

        if (isAllResults) {
            // Собираем {catName, items, score}, но у нас уже частично есть. 
            // Однако здесь можно ещё раз отсортировать или просто выводить
            // по порядку, "Всі результати" -> catNames (уже сорт. выше)
            for (const catName of finalCategoryNames) {
                if (catName === this.translations.allResults) continue; // не рендерим сам заголовок
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
            // Только одну категорию, без лимита
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

    renderSingleCategoryBlock(catName, items, productTemplate, resultContainer, showTitles, selectedCat, limitCount) {
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

        // inStock→outOfStock
        const inS = items.filter((p) => p.availability);
        const outS = items.filter((p) => !p.availability);
        const sorted = [...inS, ...outS];

        // Берём subset
        const subset = sorted.slice(0, limitCount);

        // Рендерим
        subset.forEach((prod) => {
            const presence = prod.availability ? this.translations.inStock : this.translations.outOfStock;
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

        // "Ще ..." если limitCount < items.length
        if (items.length > limitCount && !selectedCat) {
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
    }

    activateCategory(catName) {
        const catItems = this.widgetContainer.querySelectorAll('.category-item');
        catItems.forEach((ci) => {
            const text = ci.querySelector('.category-name');
            if (text && text.textContent === catName) {
                ci.classList.add('active');
            } else {
                ci.classList.remove('active');
            }
        });
    }

    async saveSearchQuery(query) {
        if (!this.userId || !query) return;
        try {
            const resp = await fetch('https://smartsearch.spefix.com/api/addSearchQuery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: query })
            });
            console.log('[LOG:saveWordsToDatabase] status=', r.status);
        } catch (err) {
            console.error('[LOG:saveWordsToDatabase] Error:', err);
        }
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded');
    new ProductSearchWidget('searchInput');
});
