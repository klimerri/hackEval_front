import s from "./UserPage.module.scss";
import { mockUser, mockKpi, mockArtifacts } from "./mockData";

const statusClass = {
    ok: s.statusOk,
    warn: s.statusWarn,
    fail: s.statusFail,
};

const kpiClass = {
    ok: s.kpiOk,
    warn: s.kpiWarn,
    fail: s.kpiFail,
};

export const UserPage = () => {
    return (
        <div className={s.container}>
            <header className={s.header}>
                <h1 className={s.title}>Дешборд участника</h1>
                <p className={s.subtitle}>
                    {mockUser.name} · {mockUser.team} · {mockUser.caseTitle}
                </p>
            </header>

            <section className={s.kpi}>
                <div className={s.kpiCard}>
                    <span className={s.kpiLabel}>Итоговый балл</span>
                    <span className={s.kpiValue}>
                        {mockKpi.totalScore}
                        <span className={s.kpiMax}> / {mockKpi.totalMax}</span>
                    </span>
                </div>
                <div className={`${s.kpiCard} ${kpiClass.ok}`}>
                    <span className={s.kpiLabel}>Пройдено проверок</span>
                    <span className={s.kpiValue}>{mockKpi.passed}</span>
                </div>
                <div className={`${s.kpiCard} ${kpiClass.warn}`}>
                    <span className={s.kpiLabel}>Предупреждения</span>
                    <span className={s.kpiValue}>{mockKpi.warnings}</span>
                </div>
                <div className={`${s.kpiCard} ${kpiClass.fail}`}>
                    <span className={s.kpiLabel}>Не пройдено</span>
                    <span className={s.kpiValue}>{mockKpi.failed}</span>
                </div>
                <div className={s.kpiCard}>
                    <span className={s.kpiLabel}>Место в рейтинге</span>
                    <span className={s.kpiValue}>#{mockKpi.rank}</span>
                </div>
            </section>

            <section className={s.artifacts}>
                <h2 className={s.sectionTitle}>Оценки по артефактам</h2>
                <ul className={s.artifactList}>
                    {mockArtifacts.map((artifact) => (
                        <li key={artifact.id} className={s.artifactItem}>
                            <span
                                className={`${s.artifactDot} ${statusClass[artifact.status]}`}
                            />
                            <div className={s.artifactBody}>
                                <div className={s.artifactRow}>
                                    <h3 className={s.artifactTitle}>{artifact.title}</h3>
                                    <span className={s.artifactScore}>
                                        {artifact.score}
                                        <span className={s.artifactMax}> / {artifact.max}</span>
                                    </span>
                                </div>
                                <p className={s.artifactMeta}>
                                    {artifact.details
                                        .map((d) => `${d.label}: ${d.value}`)
                                        .join(" · ")}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
};
