const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const db = new sqlite3.Database('./database.db');

// Настройка middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Настройка сессий
app.use(session({
    secret: 'your_secret_key', // Замените на более сложный ключ в продакшене
    resave: false,
    saveUninitialized: true
}));

// Маршрут для регистрации
app.get('/register', (req, res) => {
    res.render('register', { message: null, user: req.session.user });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Проверка наличия полей
    if (!username || !password) {
        return res.render('register', { message: 'Пожалуйста, введите логин и пароль.' });
    }

    // Проверка на существование пользователя
    const query = "SELECT * FROM users WHERE username = ?";
    db.get(query, [username], (err, row) => {
        if (err) {
            return res.status(500).render('register', { message: 'Ошибка при проверке пользователя.' });
        }
        if (row) {
            return res.render('register', { message: 'Пользователь с таким логином уже существует.' });
        }

        // Хэширование пароля
        const hashedPassword = bcrypt.hashSync(password, 10);

        // Вставка нового пользователя в базу данных
        const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
        stmt.run(username, hashedPassword, function(err) {
            if (err) {
                return res.status(500).render('register', { message: 'Ошибка при регистрации.' });
            }
            // Перенаправление на главную страницу после успешной регистрации
            res.redirect('/auth');
        });
        stmt.finalize();
    });
});

// Маршрут для авторизации
// Маршрут для авторизации
app.get('/auth', (req, res) => {
    res.render('auth', { message: null, user: req.session.user });
});

app.post('/auth', (req, res) => {
    const { username, password } = req.body;

    // Проверка наличия полей
    if (!username || !password) {
        return res.render('auth', { message: 'Пожалуйста, введите логин и пароль.' });
    }

    // Проверка пользователя в базе данных
    const query = "SELECT * FROM users WHERE username = ?";
    db.get(query, [username], (err, row) => {
        if (err) {
            return res.status(500).render('auth', { message: 'Ошибка при авторизации.' });
        }
        if (row && bcrypt.compareSync(password, row.password)) {
            // Установка сессии пользователя
            req.session.user = { id: row.id, username: row.username };
            // Перенаправление на главную страницу после успешной авторизации
            return res.redirect('/index');
        }
        res.render('auth', { message: 'Неверный логин или пароль.' });
    });
});

// Маршрут для выхода
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/index');
});

// Главная страница
app.get('/index', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Каталог товаров
app.get('/catalog', (req, res) => {
    const query = 'SELECT * FROM products';
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).send('Ошибка при получении данных из базы данных.');
        }
        res.render('catalog', { products: rows, user: req.session.user });
    });
});

// Адреса магазинов
app.get('/locations', (req, res) => {
    res.render('locations', { user: req.session.user });
});

// Страница с информацией о товаре
// Страница с информацией о товаре
app.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    const query = "SELECT * FROM products WHERE id = ?";
    db.get(query, [productId], (err, row) => {
        if (err) {
            return res.status(500).send('Ошибка при получении данных о товаре.');
        }
        if (!row) {
            return res.status(404).send('Товар не найден.');
        }

        // Парсинг JSON-массива дополнительных изображений
        let additionalImages = [];
        if (row.additional_images) {
            try {
                additionalImages = JSON.parse(row.additional_images);
            } catch (e) {
                console.error('Ошибка при парсинге дополнительных изображений:', e);
            }
        }

        // Передача сообщения из сессии
        const message = req.session.message;
        delete req.session.message;

        res.render('product', { product: row, additionalImages: additionalImages, user: req.session.user, message: message });
    });
});

// Добавление товара в избранное
app.post('/add_to_favorites', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Вы не авторизованы.');
    }

    const { productId } = req.body;

    // Проверка, что товар существует
    const productQuery = "SELECT * FROM products WHERE id = ?";
    db.get(productQuery, [productId], (err, productRow) => {
        if (err) {
            return res.status(500).send('Ошибка при проверке товара.');
        }
        if (!productRow) {
            return res.status(404).send('Товар не найден.');
        }

        // Проверка, что товар еще не в избранном
        const favoriteQuery = "SELECT * FROM favorites WHERE user_id = ? AND product_id = ?";
        db.get(favoriteQuery, [req.session.user.id, productId], (err, favoriteRow) => {
            if (err) {
                return res.status(500).send('Ошибка при проверке избранного.');
            }
            if (favoriteRow) {
                return res.status(400).send('Товар уже в избранном.');
            }

            // Добавление товара в избранное
            const insertQuery = "INSERT INTO favorites (user_id, product_id) VALUES (?, ?)";
            db.run(insertQuery, [req.session.user.id, productId], function(err) {
                if (err) {
                    return res.status(500).send('Ошибка при добавлении в избранное.');
                }
                res.send('Товар добавлен в избранное.');
            });
        });
    });
});

// Удаление товара из избранного
app.post('/remove_from_favorites', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Вы не авторизованы.');
    }

    const { productId } = req.body;

    // Удаление товара из избранного
    const deleteQuery = "DELETE FROM favorites WHERE user_id = ? AND product_id = ?";
    db.run(deleteQuery, [req.session.user.id, productId], function(err) {
        if (err) {
            return res.status(500).send('Ошибка при удалении из избранного.');
        }
        res.send('Товар удален из избранного.');
    });
});

// Страница избранного
// Маршрут для страницы избранного
app.get('/favorites', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    const query = `
        SELECT products.*
        FROM favorites
        JOIN products ON favorites.product_id = products.id
        WHERE favorites.user_id = ?
    `;
    db.all(query, [req.session.user.id], (err, rows) => {
        if (err) {
            return res.status(500).send('Ошибка при получении избранных товаров.');
        }
        res.render('favorites', { products: rows, user: req.session.user });
    });
});

// Маршрут для удаления товара из избранного
app.post('/remove_from_favorites', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Вы не авторизованы.');
    }

    const { productId } = req.body;

    // Удаление товара из избранного
    const deleteQuery = "DELETE FROM favorites WHERE user_id = ? AND product_id = ?";
    db.run(deleteQuery, [req.session.user.id, productId], function(err) {
        if (err) {
            return res.status(500).send('Ошибка при удалении из избранного.');
        }
        res.redirect('/favorites');
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});