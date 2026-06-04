import { Outlet } from "react-router-dom";
import { Drawer } from "../Drawer/Drawer";

export const LayoutWithDrawer = () => {
    return (
        <div style={{display: "flex"}}>
            <Drawer />

            <main className="main" style={{flex: 1, overflow: "auto"}}>
                <Outlet />
            </main>
        </div>
    );
};