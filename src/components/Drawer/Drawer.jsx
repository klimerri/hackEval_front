import s from "./Drawer.module.scss";

export const Drawer = () => {
    return (
        <div className={s.drawer}>
            <span className={s.logo}>HackEval</span>
            <button className={s.button}>Выйти</button>
        </div>
    )
}