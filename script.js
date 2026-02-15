class GTDApp {
    constructor() {
        this.currentCategory = 'inbox';
        this.tasks = this.loadFromStorage();
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.isDarkTheme = localStorage.getItem('gtd-dark-theme') === 'true';
        this.showWelcome = localStorage.getItem('gtd-welcome') !== 'false';

        // Drag & drop флаги
        this.dragActive = false;
        this.draggedTask = null;
        this.ghost = null;
        this.startX = 0;
        this.startY = 0;
        this.isDragging = false;
        this.dragThreshold = 5;
        this.touchDragThreshold = 10;

        window.addEventListener('resize', () => this.handleResize());
        this.init();
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    init() {
        this.bindEvents();
        this.initButtonHoverEffects();
        this.applyTheme();
        this.initDragAndDrop();

        if (this.showWelcome) {
            this.showWelcomeScreen();
        } else {
            this.renderCurrentView();
            this.updateStats();
        }
    }

    handleResize() {
        if (this.currentCategory !== 'calendar' && this.currentCategory !== 'howto') {
            this.renderTasks();
        }
    }

    // ========== ХРАНИЛИЩЕ ==========
    loadFromStorage() {
        const saved = localStorage.getItem('gtd-tasks');
        if (saved) {
            const data = JSON.parse(saved);
            if (!data.calendar) data.calendar = {};
            return data;
        }
        return {
            inbox: [], next: [], project: [], wait: [],
            delegation: [], someday: [], calendar: {}
        };
    }

    saveToStorage() {
        localStorage.setItem('gtd-tasks', JSON.stringify(this.tasks));
    }

    // ========== БАЗОВЫЕ СОБЫТИЯ ==========
    bindEvents() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchCategory(btn));
        });

        document.getElementById('logo')?.addEventListener('click', () => {
            const inboxBtn = document.querySelector('[data-category="inbox"]');
            if (inboxBtn) this.switchCategory(inboxBtn);
        });

        document.getElementById('theme-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTheme();
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'start-btn' || e.target.closest('#start-btn')) {
                this.hideWelcomeScreen();
            }
        });
    }

    // ========== ЭФФЕКТЫ НАВЕДЕНИЯ ==========
    initButtonHoverEffects() {
        const buttons = document.querySelectorAll(
            '.category-btn, #add-task-btn, #clear-completed, .nav-btn, .today-btn, .start-btn, .task-action-btn, .day-task-delete'
        );
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
                btn.style.boxShadow = '';
            });
            btn.addEventListener('mousedown', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            });
            btn.addEventListener('mouseup', () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            });
        });
    }

    // ========== DRAG & DROP (улучшенный) ==========
    initDragAndDrop() {
        // Отключаем нативный drag
        document.querySelectorAll('.task-item, .day-task-item').forEach(el => {
            el.draggable = false;
        });

        document.addEventListener('mousedown', this.handleDragStart.bind(this));
        document.addEventListener('mousemove', this.handleDragMove.bind(this));
        document.addEventListener('mouseup', this.handleDragEnd.bind(this));

        document.addEventListener('touchstart', this.handleDragStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleDragEnd.bind(this));
        document.addEventListener('touchcancel', this.handleDragEnd.bind(this));
    }

    handleDragStart(e) {
        const isTouch = e.type === 'touchstart';
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;

        const taskItem = e.target.closest('.task-item, .day-task-item');
        if (!taskItem) return;

        // Не начинаем drag, если клик по интерактивному элементу
        if (e.target.closest('.task-checkbox, .day-task-checkbox, .task-action-btn, .day-task-delete')) {
            return;
        }

        this.draggedTask = taskItem;
        this.startX = clientX;
        this.startY = clientY;
        this.isDragging = false;
        this.dragActive = false;

        if (isTouch) e.preventDefault();
        taskItem.classList.add('drag-ready');
    }

    handleDragMove(e) {
        if (!this.draggedTask) return;

        const isTouch = e.type === 'touchmove';
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;

        const dx = Math.abs(clientX - this.startX);
        const dy = Math.abs(clientY - this.startY);
        const threshold = isTouch ? this.touchDragThreshold : this.dragThreshold;

        if (!this.isDragging && (dx > threshold || dy > threshold)) {
            this.startDrag(e);
        }

        if (this.isDragging) {
            e.preventDefault();
            if (this.ghost) {
                this.ghost.style.left = (clientX - this.ghost.offsetWidth / 2) + 'px';
                this.ghost.style.top = (clientY - 20) + 'px';
            }
            this.highlightDropZones(e);
        }
    }

    handleDragEnd(e) {
        if (this.draggedTask) {
            this.draggedTask.classList.remove('drag-ready', 'dragging');
        }

        if (this.isDragging && this.draggedTask) {
            const isTouch = e.type === 'touchend' || e.type === 'touchcancel';
            const clientX = isTouch ? e.changedTouches[0].clientX : e.clientX;
            const clientY = isTouch ? e.changedTouches[0].clientY : e.clientY;

            const dropTarget = document.elementFromPoint(clientX, clientY);
            this.handleDrop(dropTarget, this.draggedTask);
        }

        // Убираем запрет выделения текста
        document.body.classList.remove('dragging-active');

        this.removeGhost();
        this.removeDropHighlights();
        this.draggedTask = null;
        this.isDragging = false;
        this.dragActive = false;
    }

    startDrag(e) {
        if (!this.draggedTask) return;

        this.isDragging = true;
        this.dragActive = true;
        this.draggedTask.classList.add('dragging');
        this.draggedTask.classList.remove('drag-ready');

        // Запрещаем выделение текста на всей странице
        document.body.classList.add('dragging-active');

        this.createGhost(this.draggedTask, e);
        if (e.cancelable) e.preventDefault();
    }

    // ✨ Новый компактный призрак
    createGhost(taskElement, e) {
        this.removeGhost();

        const ghost = document.createElement('div');
        ghost.className = 'dragging-ghost compact-ghost';

        // Получаем текст задачи
        const textElement = taskElement.querySelector('.task-text, .day-task-text');
        let taskText = textElement ? textElement.innerText.trim() : 'Задача';
        if (taskText.length > 40) taskText = taskText.slice(0, 40) + '…';

        ghost.innerHTML = `
            <i class="fas fa-grip-vertical" style="margin-right: 8px; opacity: 0.8;"></i>
            <span>${taskText}</span>
        `;

        ghost.style.position = 'fixed';
        ghost.style.zIndex = '10000';
        ghost.style.pointerEvents = 'none';

        const isTouch = e.type?.startsWith('touch');
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;

        document.body.appendChild(ghost);
        ghost.style.left = (clientX - ghost.offsetWidth / 2) + 'px';
        ghost.style.top = (clientY - 20) + 'px';

        this.ghost = ghost;
    }

    removeGhost() {
        if (this.ghost && this.ghost.parentNode) {
            this.ghost.parentNode.removeChild(this.ghost);
            this.ghost = null;
        }
    }

    highlightDropZones(e) {
        this.removeDropHighlights();

        const isTouch = e.type === 'touchmove';
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;

        const target = document.elementFromPoint(clientX, clientY);

        const categoryBtn = target?.closest('.category-btn');
        if (categoryBtn) {
            categoryBtn.classList.add('drag-over');
            this.currentDropZone = categoryBtn;
        }

        const calendarDay = target?.closest('.calendar-day');
        if (calendarDay && !calendarDay.classList.contains('empty')) {
            calendarDay.classList.add('drag-over');
            this.currentDropZone = calendarDay;
        }
    }

    removeDropHighlights() {
        document.querySelectorAll('.category-btn.drag-over, .calendar-day.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        this.currentDropZone = null;
    }

    handleDrop(dropTarget, draggedTask) {
        if (!dropTarget || !draggedTask) return;

        const categoryBtn = dropTarget.closest('.category-btn');
        if (categoryBtn) {
            const fromCategory = draggedTask.classList.contains('day-task-item') ? 'calendar' : this.currentCategory;
            const toCategory = categoryBtn.dataset.category;
            if (fromCategory !== toCategory) {
                const taskId = parseInt(draggedTask.dataset.taskId);
                this.moveTaskToCategory(taskId, fromCategory, toCategory);
            }
            return;
        }

        const calendarDay = dropTarget.closest('.calendar-day');
        if (calendarDay && !calendarDay.classList.contains('empty')) {
            const fromCategory = draggedTask.classList.contains('day-task-item') ? 'calendar' : this.currentCategory;
            const date = calendarDay.dataset.date;
            if (date && fromCategory !== 'calendar') {
                const taskId = parseInt(draggedTask.dataset.taskId);
                this.moveTaskToCalendar(taskId, fromCategory, date);
            }
            return;
        }
    }

    // ========== ПЕРЕМЕЩЕНИЕ ЗАДАЧ ==========
    moveTaskToCategory(taskId, fromCategory, toCategory) {
        taskId = parseInt(taskId);
        if (fromCategory === 'calendar') {
            let taskToMove = null;
            for (const [date, tasks] of Object.entries(this.tasks.calendar)) {
                const idx = tasks.findIndex(t => t.id === taskId);
                if (idx !== -1) {
                    taskToMove = tasks[idx];
                    tasks.splice(idx, 1);
                    if (tasks.length === 0) delete this.tasks.calendar[date];
                    break;
                }
            }
            if (taskToMove) {
                this.tasks[toCategory].unshift({ ...taskToMove, movedAt: new Date().toISOString() });
            }
        } else {
            const idx = this.tasks[fromCategory].findIndex(t => t.id === taskId);
            if (idx !== -1) {
                const task = this.tasks[fromCategory][idx];
                this.tasks[fromCategory].splice(idx, 1);
                this.tasks[toCategory].unshift({ ...task, movedAt: new Date().toISOString() });
            }
        }
        this.saveToStorage();
        if (fromCategory === this.currentCategory || toCategory === this.currentCategory) {
            this.renderTasks();
        }
        if (this.currentCategory === 'calendar') this.updateCalendar();
        this.updateStats();
        this.showNotification(`Задача перемещена в ${this.getCategoryName(toCategory)}`);
    }

    moveTaskToCalendar(taskId, fromCategory, date) {
        taskId = parseInt(taskId);
        if (fromCategory === 'calendar') {
            let taskToMove = null;
            for (const [curDate, tasks] of Object.entries(this.tasks.calendar)) {
                const idx = tasks.findIndex(t => t.id === taskId);
                if (idx !== -1) {
                    taskToMove = tasks[idx];
                    tasks.splice(idx, 1);
                    if (tasks.length === 0) delete this.tasks.calendar[curDate];
                    break;
                }
            }
            if (taskToMove) {
                if (!this.tasks.calendar[date]) this.tasks.calendar[date] = [];
                this.tasks.calendar[date].unshift({ ...taskToMove, scheduledDate: date, movedAt: new Date().toISOString() });
            }
        } else {
            const idx = this.tasks[fromCategory].findIndex(t => t.id === taskId);
            if (idx !== -1) {
                const task = this.tasks[fromCategory][idx];
                this.tasks[fromCategory].splice(idx, 1);
                if (!this.tasks.calendar[date]) this.tasks.calendar[date] = [];
                this.tasks.calendar[date].unshift({
                    ...task,
                    scheduledDate: date,
                    fromCategory,
                    movedAt: new Date().toISOString()
                });
            }
        }
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
        if (this.currentCategory === 'calendar') this.updateCalendar();
        this.showNotification(`Задача запланирована на ${this.formatDate(date)}`);
    }

    getCategoryName(category) {
        const names = {
            inbox: 'Inbox',
            next: 'Next Actions',
            project: 'Projects',
            wait: 'Waiting For',
            delegation: 'Delegation',
            someday: 'Someday/Maybe',
            calendar: 'Calendar',
            howto: 'How GTD Works'
        };
        return names[category] || category;
    }

    showNotification(message) {
        const n = document.createElement('div');
        n.className = 'notification';
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.classList.add('show'), 10);
        setTimeout(() => {
            n.classList.remove('show');
            setTimeout(() => n.remove(), 300);
        }, 2000);
    }

    // ========== ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ ==========
    switchCategory(btn) {
        if (this.showWelcome) this.hideWelcomeScreen();

        const mainContent = document.querySelector('.main-content');
        mainContent.style.opacity = '0.5';
        mainContent.style.transition = 'opacity 0.3s';

        setTimeout(() => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentCategory = btn.dataset.category;
            this.renderCurrentView();
            this.updateStats();
            mainContent.style.opacity = '1';
        }, 150);
    }

    renderCurrentView() {
        if (this.currentCategory === 'calendar') this.renderCalendar();
        else if (this.currentCategory === 'howto') this.renderHowTo();
        else this.renderTasksView();
    }

    // ========== ОБЫЧНЫЙ СПИСОК ЗАДАЧ ==========
    renderTasksView() {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <header class="content-header">
                <h1 class="category-title">${this.getCategoryName(this.currentCategory)}</h1>
                <div class="task-controls">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="search-input" placeholder="Поиск...">
                    </div>
                    <button id="clear-completed">Очистить</button>
                </div>
            </header>
            <div class="add-task-container">
                <input type="text" id="new-task-input" placeholder="Добавить задачу...">
                <button id="add-task-btn"><i class="fas fa-plus"></i></button>
            </div>
            <div class="task-list-container">
                <ul class="task-list" id="task-list"></ul>
            </div>
            <div class="simple-instructions">
                <p><i class="fas fa-hand-point-up"></i> Нажмите и удерживайте задачу, чтобы перетащить на другую категорию</p>
            </div>
        `;
        this.bindTaskEvents();
        this.renderTasks();
    }

    bindTaskEvents() {
        document.getElementById('add-task-btn')?.addEventListener('click', () => this.addTask());
        document.getElementById('new-task-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.renderTasks(e.target.value);
        });
        document.getElementById('clear-completed')?.addEventListener('click', () => this.clearCompleted());
    }

    renderTasks(searchQuery = '') {
        if (this.currentCategory === 'calendar' || this.currentCategory === 'howto') return;

        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        const tasks = this.tasks[this.currentCategory] || [];
        const filtered = searchQuery
            ? tasks.filter(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()))
            : tasks;

        if (filtered.length === 0) {
            taskList.innerHTML = `
                <li class="task-placeholder">
                    <i class="fas fa-tasks"></i>
                    <p>${searchQuery ? 'Задачи не найдены' : 'Пока нет задач. Добавьте первую!'}</p>
                </li>
            `;
            return;
        }

        const isMobile = window.innerWidth <= 768;
        taskList.innerHTML = filtered.map(task => `
            <li class="task-item" data-task-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="app.toggleTask(${task.id}, '${this.currentCategory}')">
                </div>
                <div class="task-text ${task.completed ? 'completed' : ''}">
                    ${this.escapeHtml(task.text)}
                    ${!isMobile ? `<div class="task-date">${new Date(task.createdAt).toLocaleDateString('ru-RU')}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="task-action-btn delete" 
                            onclick="app.deleteTask(${task.id}, '${this.currentCategory}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `).join('');

        this.attachTaskClickHandler(taskList);
    }

    attachTaskClickHandler(taskList) {
        if (taskList.dataset.clickHandler) return;
        taskList.addEventListener('click', (e) => {
            if (this.dragActive) return;
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            if (e.target.closest('.task-checkbox, .task-action-btn')) return;
            const taskId = parseInt(taskItem.dataset.taskId);
            this.toggleTask(taskId, this.currentCategory);
        });
        taskList.dataset.clickHandler = 'true';
    }

    addTask() {
        const input = document.getElementById('new-task-input');
        const text = input.value.trim();
        if (!text) { input.focus(); return; }

        const newTask = {
            id: Date.now(),
            text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        this.tasks[this.currentCategory].unshift(newTask);
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
        input.value = '';
        input.focus();
    }

    deleteTask(taskId, category) {
        this.tasks[category] = this.tasks[category].filter(t => t.id !== taskId);
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
    }

    toggleTask(taskId, category) {
        const task = this.tasks[category].find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveToStorage();
            this.renderTasks();
            this.updateStats();
        }
    }

    clearCompleted() {
        this.tasks[this.currentCategory] = this.tasks[this.currentCategory].filter(t => !t.completed);
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
    }

    // ========== КАЛЕНДАРЬ ==========
    renderCalendar() {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <div class="calendar-view">
                <div class="compact-calendar">
                    <div class="compact-calendar-header">
                        <div class="calendar-navigation">
                            <button id="prev-month" class="nav-btn">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <h2 id="current-month"></h2>
                            <button id="next-month" class="nav-btn">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <button id="today-btn" class="today-btn">
                            <i class="fas fa-calendar-day"></i> Сегодня
                        </button>
                    </div>
                    <div class="compact-calendar-grid" id="calendar-grid"></div>
                </div>
                <div class="day-tasks-section">
                    <h3 class="day-tasks-title">Задачи на <span id="selected-date">${this.formatDate(this.selectedDate)}</span></h3>
                    <div class="add-calendar-task">
                        <input type="text" id="calendar-task-input" placeholder="Добавить задачу на этот день...">
                        <button id="add-calendar-task-btn"><i class="fas fa-plus"></i></button>
                    </div>
                    <div class="day-tasks-list" id="day-tasks-list"></div>
                </div>
            </div>
        `;

        document.getElementById('prev-month')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month')?.addEventListener('click', () => this.changeMonth(1));
        document.getElementById('today-btn')?.addEventListener('click', () => this.goToToday());

        const addBtn = document.getElementById('add-calendar-task-btn');
        const input = document.getElementById('calendar-task-input');
        if (addBtn && input) {
            addBtn.addEventListener('click', () => this.addCalendarTask());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addCalendarTask();
            });
        }

        this.updateCalendar();
    }

    updateCalendar() {
        const currentDate = new Date(this.selectedDate + 'T12:00:00');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const monthTitle = document.getElementById('current-month');
        if (monthTitle) monthTitle.textContent = `${monthNames[month]} ${year}`;

        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';

        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => {
            const el = document.createElement('div');
            el.className = 'calendar-weekday';
            el.textContent = day;
            calendarGrid.appendChild(el);
        });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

        for (let i = 0; i < offset; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            calendarGrid.appendChild(empty);
        }

        const today = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.dataset.date = date;
            if (date === today) dayEl.classList.add('today');
            if (date === this.selectedDate) dayEl.classList.add('selected');

            const dayTasks = this.tasks.calendar[date] || [];
            dayEl.innerHTML = `
                <div class="day-number">${d}</div>
                ${dayTasks.length ? `<div class="day-task-count">${dayTasks.length}</div>` : ''}
            `;
            dayEl.addEventListener('click', () => this.selectDate(date));
            calendarGrid.appendChild(dayEl);
        }

        this.updateDayTasks();
    }

    updateDayTasks() {
        const dayTasksList = document.getElementById('day-tasks-list');
        const selectedDateElement = document.getElementById('selected-date');
        if (selectedDateElement) {
            selectedDateElement.textContent = this.formatDate(this.selectedDate);
        }
        if (!dayTasksList) return;

        const tasks = this.tasks.calendar[this.selectedDate] || [];
        if (tasks.length === 0) {
            dayTasksList.innerHTML = `
                <div class="no-tasks-message">
                    <i class="fas fa-calendar-check"></i>
                    <p>Нет задач на этот день</p>
                    <small>Добавьте задачу выше или перетащите из другой категории</small>
                </div>
            `;
            return;
        }

        dayTasksList.innerHTML = tasks.map(task => `
            <div class="day-task-item" data-task-id="${task.id}">
                <div class="day-task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="app.toggleCalendarTask(${task.id}, '${this.selectedDate}')">
                </div>
                <div class="day-task-text ${task.completed ? 'completed' : ''}">
                    ${this.escapeHtml(task.text)}
                    <div class="day-task-meta">
                        <span class="task-category">${this.getCategoryName(task.fromCategory || 'calendar')}</span>
                    </div>
                </div>
                <button class="day-task-delete" 
                        onclick="app.deleteCalendarTask(${task.id}, '${this.selectedDate}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        this.attachCalendarTaskClickHandler(dayTasksList);
    }

    attachCalendarTaskClickHandler(dayTasksList) {
        if (dayTasksList.dataset.clickHandler) return;
        dayTasksList.addEventListener('click', (e) => {
            if (this.dragActive) return;
            const taskItem = e.target.closest('.day-task-item');
            if (!taskItem) return;
            if (e.target.closest('.day-task-checkbox, .day-task-delete')) return;
            const taskId = parseInt(taskItem.dataset.taskId);
            this.toggleCalendarTask(taskId, this.selectedDate);
        });
        dayTasksList.dataset.clickHandler = 'true';
    }

    addCalendarTask() {
        const input = document.getElementById('calendar-task-input');
        const text = input.value.trim();
        if (!text) { input.focus(); return; }

        if (!this.tasks.calendar[this.selectedDate]) {
            this.tasks.calendar[this.selectedDate] = [];
        }

        const newTask = {
            id: Date.now(),
            text,
            completed: false,
            createdAt: new Date().toISOString(),
            scheduledDate: this.selectedDate,
            fromCategory: 'calendar'
        };
        this.tasks.calendar[this.selectedDate].unshift(newTask);
        this.saveToStorage();
        this.updateCalendar();
        this.updateStats();
        input.value = '';
        input.focus();
        this.showNotification('Задача добавлена в календарь');
    }

    toggleCalendarTask(taskId, date) {
        const task = (this.tasks.calendar[date] || []).find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveToStorage();
            this.updateDayTasks();
            this.updateStats();
        }
    }

    deleteCalendarTask(taskId, date) {
        if (this.tasks.calendar[date]) {
            this.tasks.calendar[date] = this.tasks.calendar[date].filter(t => t.id !== taskId);
            this.saveToStorage();
            this.updateCalendar();
            this.updateStats();
        }
    }

    selectDate(date) {
        this.selectedDate = date;
        this.updateCalendar();
    }

    changeMonth(delta) {
        const d = new Date(this.selectedDate + 'T12:00:00');
        d.setMonth(d.getMonth() + delta);
        this.selectedDate = d.toISOString().split('T')[0];
        this.updateCalendar();
    }

    goToToday() {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.updateCalendar();
    }

    // ========== HOWTO ==========
    renderHowTo() {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <div class="howto-container">
                <h1 class="howto-title">🎯 Как работает методология GTD</h1>
                
                <div class="gtd-intro">
                    <div class="intro-card">
                        <i class="fas fa-lightbulb"></i>
                        <h3>Что такое GTD?</h3>
                        <p>Getting Things Done — это система управления задачами, которая помогает организовать все ваши дела и проекты, освобождая разум для творчества и концентрации.</p>
                    </div>
                    <div class="intro-card">
                        <i class="fas fa-brain"></i>
                        <h3>Основная идея</h3>
                        <p>Записывайте все задачи вне головы. Это снижает стресс и позволяет сосредоточиться на выполнении, а не на запоминании.</p>
                    </div>
                </div>
                
                <div class="gtd-principles">
                    <h2 class="section-title">5 ключевых этапов GTD</h2>
                    <div class="principles-grid">
                        <div class="principle-card">
                            <div class="principle-header">
                                <div class="principle-number">1</div>
                                <i class="fas fa-inbox"></i>
                            </div>
                            <h3>Сбор</h3>
                            <p>Записывайте все задачи, идеи и напоминания в одном месте — вашем Inbox. Ничего не держите в голове.</p>
                            <div class="principle-tip">
                                <i class="fas fa-lightbulb"></i>
                                <span>Собирайте всё: от рабочих задач до личных мыслей</span>
                            </div>
                        </div>
                        <div class="principle-card">
                            <div class="principle-header">
                                <div class="principle-number">2</div>
                                <i class="fas fa-cogs"></i>
                            </div>
                            <h3>Обработка</h3>
                            <p>Решите, что делать с каждым элементом. Задача выполнима? Если нет — отложите или удалите.</p>
                            <div class="principle-tip">
                                <i class="fas fa-lightbulb"></i>
                                <span>Обрабатывайте Inbox регулярно, не реже раза в неделю</span>
                            </div>
                        </div>
                        <div class="principle-card">
                            <div class="principle-header">
                                <div class="principle-number">3</div>
                                <i class="fas fa-folder"></i>
                            </div>
                            <h3>Организация</h3>
                            <p>Распределите задачи по категориям: Next Actions, Projects, Waiting, Delegation, Someday.</p>
                            <div class="principle-tip">
                                <i class="fas fa-lightbulb"></i>
                                <span>Используйте drag & drop для быстрого распределения</span>
                            </div>
                        </div>
                        <div class="principle-card">
                            <div class="principle-header">
                                <div class="principle-number">4</div>
                                <i class="fas fa-search"></i>
                            </div>
                            <h3>Обзор</h3>
                            <p>Регулярно пересматривайте все списки. Обновляйте статусы, переносите задачи, корректируйте приоритеты.</p>
                            <div class="principle-tip">
                                <i class="fas fa-lightbulb"></i>
                                <span>Еженедельный обзор — залог эффективной системы</span>
                            </div>
                        </div>
                        <div class="principle-card">
                            <div class="principle-header">
                                <div class="principle-number">5</div>
                                <i class="fas fa-play"></i>
                            </div>
                            <h3>Действие</h3>
                            <p>Выполняйте задачи из соответствующих категорий в зависимости от контекста, времени и энергии.</p>
                            <div class="principle-tip">
                                <i class="fas fa-lightbulb"></i>
                                <span>Доверьтесь системе и действуйте без лишних раздумий</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="category-guide">
                    <h2 class="section-title">📋 Руководство по категориям</h2>
                    <div class="guide-cards">
                        <div class="guide-card">
                            <div class="guide-icon inbox"><i class="fas fa-inbox"></i></div>
                            <h4>Inbox</h4>
                            <p>Первичный сбор всех задач. Сюда попадает всё, что требует вашего внимания.</p>
                            <span class="guide-example">Пример: "Заказать кофе", "Позвонить маме"</span>
                        </div>
                        <div class="guide-card">
                            <div class="guide-icon next"><i class="fas fa-forward"></i></div>
                            <h4>Next Actions</h4>
                            <p>Следующие действия, которые можно выполнить прямо сейчас.</p>
                            <span class="guide-example">Пример: "Написать отчет", "Ответить на email"</span>
                        </div>
                        <div class="guide-card">
                            <div class="guide-icon project"><i class="fas fa-project-diagram"></i></div>
                            <h4>Projects</h4>
                            <p>Многошаговые задачи, требующие более одного действия для завершения.</p>
                            <span class="guide-example">Пример: "Запуск сайта", "Организация отпуска"</span>
                        </div>
                        <div class="guide-card">
                            <div class="guide-icon wait"><i class="fas fa-clock"></i></div>
                            <h4>Waiting For</h4>
                            <p>Задачи, которые зависят от других людей или внешних обстоятельств.</p>
                            <span class="guide-example">Пример: "Ответ от клиента", "Доставка заказа"</span>
                        </div>
                        <div class="guide-card">
                            <div class="guide-icon delegation"><i class="fas fa-user-friends"></i></div>
                            <h4>Delegation</h4>
                            <p>Задачи, которые вы делегировали другим, но за которыми нужно следить.</p>
                            <span class="guide-example">Пример: "Проверка кода коллегой", "Отчет от ассистента"</span>
                        </div>
                        <div class="guide-card">
                            <div class="guide-icon someday"><i class="fas fa-calendar-plus"></i></div>
                            <h4>Someday/Maybe</h4>
                            <p>Идеи и задачи на будущее, которые не требуют немедленного внимания.</p>
                            <span class="guide-example">Пример: "Изучить испанский", "Купить велосипед"</span>
                        </div>
                    </div>
                </div>
                
                <div class="workflow-section">
                    <h2 class="section-title">🔄 Рабочий процесс GTD</h2>
                    <div class="workflow-diagram">
                        <div class="workflow-step">
                            <div class="step-circle">1</div>
                            <div class="step-content">
                                <h4>Сбор информации</h4>
                                <p>Записывайте все задачи в Inbox в течение дня</p>
                            </div>
                            <div class="step-arrow"><i class="fas fa-arrow-right"></i></div>
                        </div>
                        <div class="workflow-step">
                            <div class="step-circle">2</div>
                            <div class="step-content">
                                <h4>Еженедельная обработка</h4>
                                <p>Разбирайте Inbox, распределяя задачи по категориям</p>
                            </div>
                            <div class="step-arrow"><i class="fas fa-arrow-right"></i></div>
                        </div>
                        <div class="workflow-step">
                            <div class="step-circle">3</div>
                            <div class="step-content">
                                <h4>Планирование</h4>
                                <p>Используйте календарь для задач с конкретными датами</p>
                            </div>
                            <div class="step-arrow"><i class="fas fa-arrow-right"></i></div>
                        </div>
                        <div class="workflow-step">
                            <div class="step-circle">4</div>
                            <div class="step-content">
                                <h4>Выполнение</h4>
                                <p>Работайте с Next Actions и Projects в течение недели</p>
                            </div>
                            <div class="step-arrow"><i class="fas fa-arrow-right"></i></div>
                        </div>
                        <div class="workflow-step">
                            <div class="step-circle">5</div>
                            <div class="step-content">
                                <h4>Еженедельный обзор</h4>
                                <p>Обновляйте все списки, переносите невыполненное</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="tips-section">
                    <h2 class="section-title">💡 Советы для эффективного использования</h2>
                    <div class="tips-grid">
                        <div class="tip-card">
                            <i class="fas fa-sync-alt"></i>
                            <h4>Будьте последовательны</h4>
                            <p>Регулярно используйте систему. Чем чаще вы её применяете, тем больше пользы она приносит.</p>
                        </div>
                        <div class="tip-card">
                            <i class="fas fa-compress-arrows-alt"></i>
                            <h4>Дробите большие задачи</h4>
                            <p>Разбивайте проекты на конкретные действия, которые можно выполнить за один подход.</p>
                        </div>
                        <div class="tip-card">
                            <i class="fas fa-calendar-check"></i>
                            <h4>Используйте календарь</h4>
                            <p>Задачи с конкретными датами должны быть в календаре, а не в общих списках.</p>
                        </div>
                        <div class="tip-card">
                            <i class="fas fa-mobile-alt"></i>
                            <h4>Мобильность</h4>
                            <p>Используйте приложение с телефона, чтобы добавлять задачи сразу при появлении идей.</p>
                        </div>
                    </div>
                </div>
                
                <div class="quick-start">
                    <h2 class="section-title">⚡ Быстрый старт с Think Done</h2>
                    <div class="start-steps">
                        <div class="start-step">
                            <div class="step-number">1</div>
                            <p>Начните добавлять все свои задачи в <strong>Inbox</strong></p>
                        </div>
                        <div class="start-step">
                            <div class="step-number">2</div>
                            <p>Раз в неделю обрабатывайте Inbox, распределяя задачи по категориям</p>
                        </div>
                        <div class="start-step">
                            <div class="step-number">3</div>
                            <p>Задачи с датами добавляйте в <strong>Календарь</strong></p>
                        </div>
                        <div class="start-step">
                            <div class="step-number">4</div>
                            <p>Ежедневно работайте с задачами из <strong>Next Actions</strong></p>
                        </div>
                        <div class="start-step">
                            <div class="step-number">5</div>
                            <p>Раз в неделю проводите полный обзор всех категорий</p>
                        </div>
                    </div>
                    <button class="action-btn" id="howto-start-btn">
                        <i class="fas fa-play-circle"></i> Начать использовать GTD
                    </button>
                </div>
            </div>
        `;

        setTimeout(() => {
            const startBtn = document.getElementById('howto-start-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    const inboxBtn = document.querySelector('[data-category="inbox"]');
                    if (inboxBtn) window.app.switchCategory(inboxBtn);
                });
            }
        }, 100);
    }

    // ========== СТАТИСТИКА ==========
    updateStats() {
        let total = 0, completed = 0;
        Object.entries(this.tasks).forEach(([cat, tasks]) => {
            if (cat === 'calendar') {
                Object.values(tasks).forEach(dayTasks => {
                    total += dayTasks.length;
                    completed += dayTasks.filter(t => t.completed).length;
                });
            } else if (Array.isArray(tasks)) {
                total += tasks.length;
                completed += tasks.filter(t => t.completed).length;
            }
        });

        const totalEl = document.getElementById('total-tasks');
        const completedEl = document.getElementById('completed-tasks');
        if (totalEl) totalEl.textContent = total;
        if (completedEl) completedEl.textContent = completed;

        this.updateWelcomeStats();
    }

    updateWelcomeStats() {
        let total = 0, completed = 0;
        Object.entries(this.tasks).forEach(([cat, tasks]) => {
            if (cat === 'calendar') {
                Object.values(tasks).forEach(dayTasks => {
                    total += dayTasks.length;
                    completed += dayTasks.filter(t => t.completed).length;
                });
            } else if (Array.isArray(tasks)) {
                total += tasks.length;
                completed += tasks.filter(t => t.completed).length;
            }
        });

        const welcomeTotal = document.getElementById('welcome-total-tasks');
        const welcomeCompleted = document.getElementById('welcome-completed-tasks');
        if (welcomeTotal) welcomeTotal.textContent = total;
        if (welcomeCompleted) welcomeCompleted.textContent = completed;
    }

    // ========== WELCOME SCREEN ==========
    showWelcomeScreen() {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-content">
                    <div class="welcome-logo">
                        <i class="fas fa-check-circle"></i>
                        <h1>Think Done</h1>
                    </div>
                    <div class="welcome-text">
                        <h2>Добро пожаловать в GTD-систему</h2>
                        <p>Организуйте свои задачи и проекты с помощью проверенной методологии <strong>Getting Things Done</strong>.</p>
                    </div>
                    <div class="welcome-features">
                        <div class="feature">
                            <i class="fas fa-inbox"></i>
                            <h4>Inbox</h4>
                            <p>Собирайте все входящие идеи</p>
                        </div>
                        <div class="feature">
                            <i class="fas fa-calendar-alt"></i>
                            <h4>Календарь</h4>
                            <p>Планируйте задачи по дням</p>
                        </div>
                        <div class="feature">
                            <i class="fas fa-exchange-alt"></i>
                            <h4>Drag & Drop</h4>
                            <p>Перетаскивайте задачи между категориями</p>
                        </div>
                        <div class="feature">
                            <i class="fas fa-moon"></i>
                            <h4>Темная тема</h4>
                            <p>Работайте в удобном режиме</p>
                        </div>
                    </div>
                    <div class="welcome-quick-stats">
                        <div class="stat-box">
                            <span class="stat-number" id="welcome-total-tasks">0</span>
                            <span class="stat-label">Всего задач</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number" id="welcome-completed-tasks">0</span>
                            <span class="stat-label">Выполнено</span>
                        </div>
                    </div>
                    <button class="start-btn" id="start-btn">
                        <i class="fas fa-play"></i> Начать работу
                    </button>
                </div>
            </div>
        `;
        this.updateWelcomeStats();
    }

    hideWelcomeScreen() {
        this.showWelcome = false;
        localStorage.setItem('gtd-welcome', 'false');
        this.renderCurrentView();
        this.updateStats();
    }

    // ========== ТЕМА ==========
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        localStorage.setItem('gtd-dark-theme', this.isDarkTheme);
        this.applyTheme();
    }

    applyTheme() {
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        const icon = document.getElementById('theme-icon');
        if (icon) icon.className = this.isDarkTheme ? 'fas fa-sun' : 'fas fa-moon';
    }

    // ========== УТИЛИТЫ ==========
    formatDate(dateString) {
        const date = new Date(dateString + 'T12:00:00');
        return date.toLocaleDateString('ru-RU', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ========== ГЛОБАЛЬНЫЙ ЗАПУСК ==========
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GTDApp();
    window.app = app;
});