import s from "./StylePage.module.scss";

export const StylePage = () => {
    return (
        <div className={s.container}>
        <h1 className={s.title}>Заголовок на странице главный</h1>
        <h2 className={s.subtitle}>Подзаголовок на странице, акценты</h2>
        <span className={s.text}>Текст на странице, основной контент</span>
        <span className={s.accent}>Акцентный текст, выделение важного</span>
        <span className={s.green}>Зеленый</span>
        <span className={s.yellow}>Желтый</span>
        <span className={s.red}>Красный</span>
        <div className={s.block}>
            <div className={s.text}>Тут какой-то текст ляля, обводку хотите используйе, хотите нет. Если блок куда-то ведет, то используйте hover.
                Если нет, то только основной цвет.
            </div>
        </div>
        <div className={s.blockGreen}>
            <span className={s.green}>Зеленый</span>
        </div>
        <div className={s.blockYellow}>
            <span className={s.yellow}>Желтый</span>
        </div>
        <div className={s.blockRed}>
            <span className={s.red}>Красный</span>
        </div>
        <button className={s.button}>Кнопка</button>
        </div>
    )
}