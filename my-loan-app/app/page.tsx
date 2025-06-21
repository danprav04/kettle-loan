import AuthForm from "@/components/AuthForm";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
    const token = await verifyToken();
    if(token) {
        redirect('/dashboard');
    }

    return (
        <main>
           <AuthForm />
        </main>
    );
}