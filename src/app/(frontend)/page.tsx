import { redirect } from 'next/navigation'

/** This project is API + admin only; the app itself lives in reclimate-dmrv. */
export default function HomePage() {
  redirect('/admin')
}
