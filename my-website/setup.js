const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');


// Создание таблицы users
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Ошибка при создании таблицы users:', err.message);
        } else {
            console.log('Таблица users создана или уже существует.');
        }
    });
});

// Закрытие соединения с базой данных
db.close((err) => {
    if (err) {
        console.error('Ошибка при закрытии соединения:', err.message);
    } else {
        console.log('Соединение с базой данных закрыто.');
    }
});