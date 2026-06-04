export const mockUser = {
    name: "Иван Петров",
    email: "ivan.petrov@example.com",
    role: "участник",
    team: "Code Wizards",
    caseTitle: "Умный помощник для HR",
};

export const mockKpi = {
    totalScore: 78,
    totalMax: 100,
    rank: 5,
    passed: 3,
    warnings: 2,
    failed: 0,
};

export const mockArtifacts = [
    {
        id: "code",
        title: "Код (репозиторий)",
        score: 18,
        max: 20,
        status: "ok",
        details: [
            { label: "README", value: "найден" },
            { label: "LICENSE", value: "найден" },
            { label: "Тесты в Docker", value: "пройдены" },
        ],
    },
    {
        id: "docs",
        title: "Документация",
        score: 12,
        max: 15,
        status: "warn",
        details: [
            { label: "Описание системы", value: "есть" },
            { label: "Инструкция развёртывания", value: "частично" },
            { label: "Изображения/схемы", value: "0 шт." },
        ],
    },
    {
        id: "presentation",
        title: "Презентация",
        score: 9,
        max: 10,
        status: "ok",
        details: [
            { label: "Слайдов", value: "12" },
            { label: "Обязательные разделы", value: "7 / 7" },
        ],
    },
    {
        id: "screencast",
        title: "Скринкаст",
        score: 8,
        max: 10,
        status: "ok",
        details: [
            { label: "Длительность", value: "4 мин 12 сек" },
            { label: "Разрешение", value: "1920×1080" },
        ],
    },
    {
        id: "algos",
        title: "Алгоритмический модуль",
        score: 25,
        max: 30,
        status: "warn",
        details: [
            { label: "Решено задач", value: "5 / 6" },
            { label: "Вердикты", value: "4 OK, 1 TL" },
        ],
    },
];
