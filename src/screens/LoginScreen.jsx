import React from "react";
import { DEMO_USERS, useAuth } from "../auth";
import { COLORS, S } from "../lib/constants/ui";

export default function LoginScreen() {
    const { login } = useAuth();

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f9fafb"
        }}>
            <div style={{
                marginBottom: 32,
                textAlign: "center"
            }}>
                <h1 style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: "#111827",
                    marginBottom: 8
                }}>
                    LENGLART - ERP PROD
                </h1>
                <p style={{ color: "#6b7280", fontSize: 14 }}>
                    Sélectionnez un compte de démonstration pour accéder à l'application.
                </p>
            </div>

            <div style={{
                display: "grid",
                gap: 12,
                width: "100%",
                maxWidth: 400
            }}>
                {DEMO_USERS.map(u => (
                    <button
                        key={u.id}
                        onClick={() => login(u)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            padding: 16,
                            background: "white",
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 12,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "#000"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
                    >
                        <div style={{
                            width: 48, height: 48,
                            borderRadius: "50%",
                            background: "#e5e7eb",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16, fontWeight: 700, color: "#6b7280"
                        }}>
                            {u.avatarUrl ? (
                                <img src={u.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                u.initials || u.name.substring(0, 2).toUpperCase()
                            )}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: "#111827" }}>{u.name}</div>
                            <div style={{ fontSize: 13, color: "#6b7280" }}>{u.role.toUpperCase()}</div>
                        </div>
                    </button>
                ))}
            </div>

            <div style={{ marginTop: 32, opacity: 0.4, fontSize: 12 }}>
                Environment de Test - v2.4
            </div>
        </div>
    );
}
