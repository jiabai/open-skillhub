"use client"

import { LandingPage } from "@/components/landing/landing-page"
import type { User } from "@/types"

export default function HomePage({ currentUser }: { currentUser?: User | null }) {
  return <LandingPage currentUser={currentUser} />
}
