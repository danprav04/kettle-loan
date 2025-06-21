import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import DashboardClient from '@/components/DashboardClient';
import { BASE_URL } from '@/app/constants';
import { cookies } from 'next/headers';

async function getDashboardData() {
    const cookieHeader = cookies().toString();
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
        headers: {
            'Cookie': cookieHeader
        },
        cache: 'no-store' 
    });

    if (!res.ok) {
       return null;
    }
    return res.json();
}

export default async function Dashboard() {
    const tokenPayload = await verifyToken();
    if (!tokenPayload) {
        redirect(`/`);
    }

    const data = await getDashboardData();
    
    if(!data) {
        return <div>Error loading data. Please try logging in again.</div>
    }

    return <DashboardClient initialData={data} />;
}