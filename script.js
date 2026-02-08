class GTDApp {
    constructor() {
        this.currentCategory = 'inbox';
        this.tasks = this.loadFromStorage();
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.isDarkTheme = localStorage.getItem('gtd-dark-theme') === 'true';
        this.showWelcome = localStorage.getItem('gtd-welcome') !== 'false';
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        this.init();
    }
    
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
    
    loadFromStorage() {
        const saved = localStorage.getItem('gtd-tasks');
        if (saved) {
            const data = JSON.parse(saved);
            if (!data.calendar) {
                data.calendar = {};
            }
            return data;
        }
        
        return {
            inbox: [],
            next: [],
            project: [],
            wait: [],
            delegation: [],
            someday: [],
            calendar: {}
        };
    }
    
    saveToStorage() {
        localStorage.setItem('gtd-tasks', JSON.stringify(this.tasks));
    }
    
    bindEvents() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchCategory(btn));
        });
        
        document.getElementById('logo').addEventListener('click', () => {
            const inboxBtn = document.querySelector('[data-category="inbox"]');
            if (inboxBtn) {
                this.switchCategory(inboxBtn);
            }
        });
        
        document.getElementById('theme-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTheme();
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.id === 'start-btn' || e.target.closest('#start-btn')) {
                this.hideWelcomeScreen();
            }
        });
    }
    
    initButtonHoverEffects() {
        const buttons = document.querySelectorAll('.category-btn, #add-task-btn, #clear-completed, .nav-btn, .today-btn, .start-btn, .task-action-btn, .day-task-delete');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-1px)';
                button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = '';
                button.style.boxShadow = '';
            });
            
            button.addEventListener('mousedown', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            });
            
            button.addEventListener('mouseup', () => {
                button.style.transform = 'translateY(-1px)';
                button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            });
        });
    }
    
    initDragAndDrop() {
        // Инициализация drag & drop для задач
        this.initTaskDragAndDrop();
        
        // Инициализация drag & drop для кнопок категорий
        this.initCategoryDropZones();
        
        // Инициализация drag & drop для календаря
        this.initCalendarDropZone();
    }
    
    // Простой drag & drop для задач (работает на мобильных)
    initTaskDragAndDrop() {
        let draggedTask = null;
        let startX, startY;
        let isDragging = false;
        
        // Обработчики для мыши
        document.addEventListener('mousedown', (e) => {
            const taskItem = e.target.closest('.task-item, .day-task-item');
            if (taskItem && taskItem.draggable) {
                draggedTask = taskItem;
                startX = e.clientX;
                startY = e.clientY;
                isDragging = false;
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (draggedTask && !isDragging) {
                const dx = Math.abs(e.clientX - startX);
                const dy = Math.abs(e.clientY - startY);
                
                // Если переместили больше 5px, начинаем перетаскивание
                if (dx > 5 || dy > 5) {
                    isDragging = true;
                    draggedTask.classList.add('dragging');
                    
                    // Создаем ghost элемент
                    const ghost = draggedTask.cloneNode(true);
                    ghost.classList.add('dragging-ghost');
                    ghost.style.position = 'fixed';
                    ghost.style.zIndex = '10000';
                    ghost.style.opacity = '0.8';
                    ghost.style.pointerEvents = 'none';
                    document.body.appendChild(ghost);
                    
                    // Обновляем позицию ghost при движении
                    const updateGhostPosition = (event) => {
                        ghost.style.left = (event.clientX - ghost.offsetWidth / 2) + 'px';
                        ghost.style.top = (event.clientY - 20) + 'px';
                    };
                    
                    updateGhostPosition(e);
                    
                    const mouseMoveHandler = (event) => {
                        updateGhostPosition(event);
                    };
                    
                    const mouseUpHandler = (event) => {
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);
                        
                        // Находим элемент под курсором
                        const elementUnderCursor = document.elementFromPoint(event.clientX, event.clientY);
                        this.handleDrop(elementUnderCursor, draggedTask);
                        
                        // Очистка
                        if (ghost.parentNode) {
                            document.body.removeChild(ghost);
                        }
                        draggedTask.classList.remove('dragging');
                        draggedTask = null;
                        isDragging = false;
                    };
                    
                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                }
            }
        });
        
        // Обработчики для touch (мобильные устройства)
        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const taskItem = e.target.closest('.task-item, .day-task-item');
            if (taskItem && taskItem.draggable) {
                draggedTask = taskItem;
                startX = touch.clientX;
                startY = touch.clientY;
                isDragging = false;
                e.preventDefault(); // Предотвращаем скролл
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (draggedTask && !isDragging) {
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - startX);
                const dy = Math.abs(touch.clientY - startY);
                
                if (dx > 10 || dy > 10) {
                    isDragging = true;
                    draggedTask.classList.add('dragging');
                    
                    // Создаем ghost для touch
                    const ghost = draggedTask.cloneNode(true);
                    ghost.classList.add('dragging-ghost');
                    ghost.style.position = 'fixed';
                    ghost.style.zIndex = '10000';
                    ghost.style.opacity = '0.8';
                    ghost.style.pointerEvents = 'none';
                    document.body.appendChild(ghost);
                    
                    const updateGhostPosition = (touchEvent) => {
                        const touch = touchEvent.touches[0];
                        ghost.style.left = (touch.clientX - ghost.offsetWidth / 2) + 'px';
                        ghost.style.top = (touch.clientY - 20) + 'px';
                    };
                    
                    updateGhostPosition(e);
                    
                    const touchMoveHandler = (touchEvent) => {
                        updateGhostPosition(touchEvent);
                        touchEvent.preventDefault(); // Предотвращаем скролл
                    };
                    
                    const touchEndHandler = (touchEvent) => {
                        document.removeEventListener('touchmove', touchMoveHandler);
                        document.removeEventListener('touchend', touchEndHandler);
                        
                        const touch = touchEvent.changedTouches[0];
                        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                        this.handleDrop(elementUnderTouch, draggedTask);
                        
                        // Очистка
                        if (ghost.parentNode) {
                            document.body.removeChild(ghost);
                        }
                        draggedTask.classList.remove('dragging');
                        draggedTask = null;
                        isDragging = false;
                    };
                    
                    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
                    document.addEventListener('touchend', touchEndHandler);
                }
            }
        }, { passive: false });
    }
    
    // Обработка сброса задачи
    handleDrop(dropTarget, draggedTask) {
        if (!dropTarget || !draggedTask) return;
        
        // Проверяем, на какую кнопку категории сбросили
        const categoryBtn = dropTarget.closest('.category-btn');
        if (categoryBtn) {
            const fromCategory = draggedTask.classList.contains('day-task-item') ? 'calendar' : this.currentCategory;
            const toCategory = categoryBtn.dataset.category;
            
            if (fromCategory !== toCategory) {
                const taskId = draggedTask.dataset.taskId;
                this.moveTaskToCategory(taskId, fromCategory, toCategory);
            }
            return;
        }
        
        // Проверяем, на какой день календаря сбросили
        const calendarDay = dropTarget.closest('.calendar-day');
        if (calendarDay && !calendarDay.classList.contains('empty')) {
            const fromCategory = draggedTask.classList.contains('day-task-item') ? 'calendar' : this.currentCategory;
            const date = calendarDay.dataset.date;
            
            if (date && fromCategory !== 'calendar') {
                const taskId = draggedTask.dataset.taskId;
                this.moveTaskToCalendar(taskId, fromCategory, date);
            }
            return;
        }
    }
    
    // Зоны сброса для кнопок категорий
    initCategoryDropZones() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('dragover', (e) => {
                e.preventDefault();
                btn.classList.add('drag-over');
            });
            
            btn.addEventListener('dragleave', () => {
                btn.classList.remove('drag-over');
            });
            
            btn.addEventListener('drop', (e) => {
                e.preventDefault();
                btn.classList.remove('drag-over');
                
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.fromCategory !== btn.dataset.category) {
                        this.moveTaskToCategory(data.taskId, data.fromCategory, btn.dataset.category);
                    }
                } catch (error) {
                    console.error('Ошибка перемещения задачи:', error);
                }
            });
        });
    }
    
    // Зона сброса для календаря
    initCalendarDropZone() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (calendarGrid) {
            calendarGrid.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.target.classList.contains('calendar-day')) {
                    e.target.classList.add('drag-over');
                }
            });
            
            calendarGrid.addEventListener('dragleave', (e) => {
                if (e.target.classList.contains('calendar-day')) {
                    e.target.classList.remove('drag-over');
                }
            });
            
            calendarGrid.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.target.classList.contains('calendar-day')) {
                    e.target.classList.remove('drag-over');
                    
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                        const date = e.target.dataset.date;
                        this.moveTaskToCalendar(data.taskId, data.fromCategory, date);
                    } catch (error) {
                        console.error('Ошибка перемещения задачи в календарь:', error);
                    }
                }
            });
        }
    }
    
    moveTaskToCategory(taskId, fromCategory, toCategory) {
        taskId = parseInt(taskId);
        
        if (fromCategory === 'calendar') {
            // Находим задачу в календаре
            let taskToMove = null;
            let taskDate = null;
            
            for (const [date, tasks] of Object.entries(this.tasks.calendar)) {
                const taskIndex = tasks.findIndex(task => task.id === taskId);
                if (taskIndex !== -1) {
                    taskToMove = tasks[taskIndex];
                    taskDate = date;
                    tasks.splice(taskIndex, 1);
                    
                    if (tasks.length === 0) {
                        delete this.tasks.calendar[date];
                    }
                    break;
                }
            }
            
            if (taskToMove) {
                this.tasks[toCategory].unshift({
                    ...taskToMove,
                    movedAt: new Date().toISOString()
                });
            }
        } else {
            // Находим задачу в обычной категории
            const taskIndex = this.tasks[fromCategory].findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                const task = this.tasks[fromCategory][taskIndex];
                this.tasks[fromCategory].splice(taskIndex, 1);
                this.tasks[toCategory].unshift({
                    ...task,
                    movedAt: new Date().toISOString()
                });
            }
        }
        
        this.saveToStorage();
        
        // Обновляем отображение
        if (fromCategory === this.currentCategory || toCategory === this.currentCategory) {
            this.renderTasks();
        }
        
        if (this.currentCategory === 'calendar') {
            this.updateCalendar();
        }
        
        this.updateStats();
        this.showNotification(`Задача перемещена в ${this.getCategoryName(toCategory)}`);
    }
    
    moveTaskToCalendar(taskId, fromCategory, date) {
        taskId = parseInt(taskId);
        
        if (fromCategory === 'calendar') {
            // Перемещение внутри календаря
            let taskToMove = null;
            let sourceDate = null;
            
            for (const [currentDate, tasks] of Object.entries(this.tasks.calendar)) {
                const taskIndex = tasks.findIndex(task => task.id === taskId);
                if (taskIndex !== -1) {
                    taskToMove = tasks[taskIndex];
                    sourceDate = currentDate;
                    tasks.splice(taskIndex, 1);
                    
                    if (tasks.length === 0) {
                        delete this.tasks.calendar[currentDate];
                    }
                    break;
                }
            }
            
            if (taskToMove) {
                if (!this.tasks.calendar[date]) {
                    this.tasks.calendar[date] = [];
                }
                this.tasks.calendar[date].unshift({
                    ...taskToMove,
                    scheduledDate: date,
                    movedAt: new Date().toISOString()
                });
            }
        } else {
            // Перемещение из категории в календарь
            const taskIndex = this.tasks[fromCategory].findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                const task = this.tasks[fromCategory][taskIndex];
                this.tasks[fromCategory].splice(taskIndex, 1);
                
                if (!this.tasks.calendar[date]) {
                    this.tasks.calendar[date] = [];
                }
                
                this.tasks.calendar[date].unshift({
                    ...task,
                    scheduledDate: date,
                    fromCategory: fromCategory,
                    movedAt: new Date().toISOString()
                });
            }
        }
        
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
        
        if (this.currentCategory === 'calendar') {
            this.updateCalendar();
        }
        
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
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }
    
switchCategory(btn) {
    if (this.showWelcome) {
        this.hideWelcomeScreen();
    }
    
    // Плавное скрытие текущего контента
    const mainContent = document.querySelector('.main-content');
    mainContent.style.opacity = '0.5';
    mainContent.style.transition = 'opacity 0.3s';
    
    setTimeout(() => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.category;
        
        this.renderCurrentView();
        this.updateStats();
        
        // Плавное появление нового контента
        mainContent.style.opacity = '1';
    }, 150);
}
    
    renderCurrentView() {
        if (this.currentCategory === 'calendar') {
            this.renderCalendar();
        } else if (this.currentCategory === 'howto') {
            this.renderHowTo();
        } else {
            this.renderTasksView();
        }
    }
    
    renderTasksView() {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <header class="content-header">
                <h1 class="category-title" id="current-category">${this.getCategoryName(this.currentCategory)}</h1>
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
                <button id="add-task-btn">
                    <i class="fas fa-plus"></i>
                </button>
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
        this.initDragAndDrop();
    }
    
    bindTaskEvents() {
        const addBtn = document.getElementById('add-task-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addTask());
        }
        
        const input = document.getElementById('new-task-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTask();
            });
        }
        
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTasks(e.target.value);
            });
        }
        
        const clearBtn = document.getElementById('clear-completed');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCompleted());
        }
    }
    
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
                        <button id="add-calendar-task-btn">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="day-tasks-list" id="day-tasks-list"></div>
                </div>
            </div>
        `;
        
        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('today-btn').addEventListener('click', () => this.goToToday());
        
        // Добавляем возможность добавления задачи в календарь
        const addCalendarBtn = document.getElementById('add-calendar-task-btn');
        const calendarInput = document.getElementById('calendar-task-input');
        
        if (addCalendarBtn && calendarInput) {
            addCalendarBtn.addEventListener('click', () => this.addCalendarTask());
            calendarInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addCalendarTask();
            });
        }
        
        this.updateCalendar();
    }
    
    addCalendarTask() {
        const input = document.getElementById('calendar-task-input');
        const text = input.value.trim();
        
        if (!text) {
            input.focus();
            return;
        }
        
        if (!this.tasks.calendar[this.selectedDate]) {
            this.tasks.calendar[this.selectedDate] = [];
        }
        
        const newTask = {
            id: Date.now(),
            text: text,
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
    
    updateCalendar() {
        const currentDate = new Date(this.selectedDate + 'T12:00:00');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                          'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        
        const monthTitle = document.getElementById('current-month');
        if (monthTitle) {
            monthTitle.textContent = `${monthNames[month]} ${year}`;
        }
        
        const calendarGrid = document.getElementById('calendar-grid');
        if (calendarGrid) {
            calendarGrid.innerHTML = '';
            
            ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-weekday';
                dayElement.textContent = day;
                calendarGrid.appendChild(dayElement);
            });
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
            const firstDayOfWeek = firstDay.getDay();
            const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
            
            for (let i = 0; i < offset; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'calendar-day empty';
                calendarGrid.appendChild(emptyDay);
            }
            
            const today = new Date().toISOString().split('T')[0];
            
            for (let day = 1; day <= lastDay.getDate(); day++) {
                const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.dataset.date = date;
                dayElement.draggable = true;
                
                if (date === today) {
                    dayElement.classList.add('today');
                }
                
                if (date === this.selectedDate) {
                    dayElement.classList.add('selected');
                }
                
                const dayTasks = this.tasks.calendar[date] || [];
                const taskCount = dayTasks.length;
                
                dayElement.innerHTML = `
                    <div class="day-number">${day}</div>
                    ${taskCount > 0 ? `<div class="day-task-count">${taskCount}</div>` : ''}
                `;
                
                dayElement.addEventListener('click', () => this.selectDate(date));
                calendarGrid.appendChild(dayElement);
            }
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
            <div class="day-task-item" data-task-id="${task.id}" draggable="true">
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
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.updateCalendar();
    }
    
    changeMonth(delta) {
        const currentDate = new Date(this.selectedDate + 'T12:00:00');
        currentDate.setMonth(currentDate.getMonth() + delta);
        this.selectedDate = currentDate.toISOString().split('T')[0];
        this.updateCalendar();
    }
    
    goToToday() {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.updateCalendar();
    }
    
    toggleCalendarTask(taskId, date) {
        taskId = parseInt(taskId);
        const task = (this.tasks.calendar[date] || []).find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveToStorage();
            this.updateDayTasks();
            this.updateStats();
        }
    }
    
    deleteCalendarTask(taskId, date) {
        taskId = parseInt(taskId);
        if (this.tasks.calendar[date]) {
            this.tasks.calendar[date] = this.tasks.calendar[date].filter(task => task.id !== taskId);
            this.saveToStorage();
            this.updateCalendar();
            this.updateStats();
        }
    }
    
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
    
    updateWelcomeStats() {
        let totalTasks = 0;
        let completedTasks = 0;
        
        Object.entries(this.tasks).forEach(([category, tasks]) => {
            if (category !== 'calendar') {
                if (Array.isArray(tasks)) {
                    totalTasks += tasks.length;
                    completedTasks += tasks.filter(task => task.completed).length;
                }
            } else {
                Object.values(tasks).forEach(dayTasks => {
                    totalTasks += dayTasks.length;
                    completedTasks += dayTasks.filter(task => task.completed).length;
                });
            }
        });
        
        const welcomeTotal = document.getElementById('welcome-total-tasks');
        const welcomeCompleted = document.getElementById('welcome-completed-tasks');
        
        if (welcomeTotal) welcomeTotal.textContent = totalTasks;
        if (welcomeCompleted) welcomeCompleted.textContent = completedTasks;
    }
    
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
                        <div class="guide-icon inbox">
                            <i class="fas fa-inbox"></i>
                        </div>
                        <h4>Inbox</h4>
                        <p>Первичный сбор всех задач. Сюда попадает всё, что требует вашего внимания.</p>
                        <span class="guide-example">Пример: "Заказать кофе", "Позвонить маме"</span>
                    </div>
                    
                    <div class="guide-card">
                        <div class="guide-icon next">
                            <i class="fas fa-forward"></i>
                        </div>
                        <h4>Next Actions</h4>
                        <p>Следующие действия, которые можно выполнить прямо сейчас.</p>
                        <span class="guide-example">Пример: "Написать отчет", "Ответить на email"</span>
                    </div>
                    
                    <div class="guide-card">
                        <div class="guide-icon project">
                            <i class="fas fa-project-diagram"></i>
                        </div>
                        <h4>Projects</h4>
                        <p>Многошаговые задачи, требующие более одного действия для завершения.</p>
                        <span class="guide-example">Пример: "Запуск сайта", "Организация отпуска"</span>
                    </div>
                    
                    <div class="guide-card">
                        <div class="guide-icon wait">
                            <i class="fas fa-clock"></i>
                        </div>
                        <h4>Waiting For</h4>
                        <p>Задачи, которые зависят от других людей или внешних обстоятельств.</p>
                        <span class="guide-example">Пример: "Ответ от клиента", "Доставка заказа"</span>
                    </div>
                    
                    <div class="guide-card">
                        <div class="guide-icon delegation">
                            <i class="fas fa-user-friends"></i>
                        </div>
                        <h4>Delegation</h4>
                        <p>Задачи, которые вы делегировали другим, но за которыми нужно следить.</p>
                        <span class="guide-example">Пример: "Проверка кода коллегой", "Отчет от ассистента"</span>
                    </div>
                    
                    <div class="guide-card">
                        <div class="guide-icon someday">
                            <i class="fas fa-calendar-plus"></i>
                        </div>
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
                        <div class="step-arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="workflow-step">
                        <div class="step-circle">2</div>
                        <div class="step-content">
                            <h4>Еженедельная обработка</h4>
                            <p>Разбирайте Inbox, распределяя задачи по категориям</p>
                        </div>
                        <div class="step-arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="workflow-step">
                        <div class="step-circle">3</div>
                        <div class="step-content">
                            <h4>Планирование</h4>
                            <p>Используйте календарь для задач с конкретными датами</p>
                        </div>
                        <div class="step-arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                    </div>
                    
                    <div class="workflow-step">
                        <div class="step-circle">4</div>
                        <div class="step-content">
                            <h4>Выполнение</h4>
                            <p>Работайте с Next Actions и Projects в течение недели</p>
                        </div>
                        <div class="step-arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
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
                <button class="action-btn" onclick="app.switchCategory(document.querySelector('[data-category=\"inbox\"]'))">
                    <i class="fas fa-play-circle"></i> Начать использовать GTD
                </button>
            </div>
        </div>
    `;

    setTimeout(() => {
    const startBtn = document.querySelector('.action-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const inboxBtn = document.querySelector('[data-category="inbox"]');
            if (inboxBtn) {
                window.app.switchCategory(inboxBtn);
            }
        });
    }
}, 100);
}
    
    addTask() {
        const input = document.getElementById('new-task-input');
        const text = input.value.trim();
        
        if (!text) {
            input.focus();
            return;
        }
        
        const newTask = {
            id: Date.now(),
            text: text,
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
        this.tasks[category] = this.tasks[category].filter(task => task.id !== taskId);
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
    }
    
    toggleTask(taskId, category) {
        const task = this.tasks[category].find(task => task.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveToStorage();
            this.renderTasks();
            this.updateStats();
        }
    }
    
    clearCompleted() {
        this.tasks[this.currentCategory] = this.tasks[this.currentCategory].filter(task => !task.completed);
        this.saveToStorage();
        this.renderTasks();
        this.updateStats();
    }
    
    renderTasks(searchQuery = '') {
        if (this.currentCategory === 'calendar' || this.currentCategory === 'howto') {
            return;
        }
        
        const taskList = document.getElementById('task-list');
        const tasks = this.tasks[this.currentCategory];
        
        const filteredTasks = searchQuery 
            ? tasks.filter(task => task.text.toLowerCase().includes(searchQuery.toLowerCase()))
            : tasks;
        
        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <li class="task-placeholder">
                    <i class="fas fa-tasks"></i>
                    <p>${searchQuery ? 'Задачи не найдены' : 'Пока нет задач. Добавьте первую!'}</p>
                </li>
            `;
            return;
        }
        
        const isMobile = window.innerWidth <= 768;
        
        taskList.innerHTML = filteredTasks.map(task => `
            <li class="task-item" data-task-id="${task.id}" draggable="true">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="app.toggleTask(${task.id}, '${this.currentCategory}')">
                </div>
                <div class="task-text ${task.completed ? 'completed' : ''}">
                    ${this.escapeHtml(task.text)}
                    ${!isMobile ? `<div class="task-date">
                        ${new Date(task.createdAt).toLocaleDateString('ru-RU')}
                    </div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="task-action-btn delete" 
                            onclick="app.deleteTask(${task.id}, '${this.currentCategory}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `).join('');
    }
    
    updateStats() {
        let totalTasks = 0;
        let completedTasks = 0;
        
        Object.entries(this.tasks).forEach(([category, tasks]) => {
            if (category !== 'calendar') {
                if (Array.isArray(tasks)) {
                    totalTasks += tasks.length;
                    completedTasks += tasks.filter(task => task.completed).length;
                }
            } else {
                Object.values(tasks).forEach(dayTasks => {
                    totalTasks += dayTasks.length;
                    completedTasks += dayTasks.filter(task => task.completed).length;
                });
            }
        });
        
        const totalElement = document.getElementById('total-tasks');
        const completedElement = document.getElementById('completed-tasks');
        
        if (totalElement) totalElement.textContent = totalTasks;
        if (completedElement) completedElement.textContent = completedTasks;
        
        this.updateWelcomeStats();
    }
    
    formatDate(dateString) {
        const date = new Date(dateString + 'T12:00:00');
        return date.toLocaleDateString('ru-RU', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        localStorage.setItem('gtd-dark-theme', this.isDarkTheme);
        this.applyTheme();
    }
    
    applyTheme() {
        if (this.isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.getElementById('theme-icon').className = 'fas fa-sun';
        } else {
            document.body.classList.remove('dark-theme');
            document.getElementById('theme-icon').className = 'fas fa-moon';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}



let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new GTDApp();
    window.app = app;
});