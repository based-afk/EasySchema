import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroHeader } from "../components/header";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { ChevronRight } from "lucide-react";
import { FeatureIntelligenceCarousel } from "@/components/landing/FeatureIntelligenceCarousel";

export default function HeroSection() {
  return (
    <>
      <HeroHeader />
      <main className="overflow-x-hidden">
        <section>
          <div className="py-24 md:pb-32 lg:pb-36 lg:pt-72">
            <div className="relative mx-auto flex max-w-7xl flex-col px-6 lg:block lg:px-12">
              <div className="mx-auto max-w-lg text-center lg:ml-0 lg:max-w-full lg:text-left">
                <h1 className="mt-8 max-w-2xl text-balance font-light text-5xl md:text-6xl lg:mt-16 xl:text-7xl">
                  Build 11x Faster with{" "}
                  <span className="underline">EasySchema</span>
                </h1>
                <p className="mt-8 max-w-2xl text-balance font-light text-lg">
                  Build professional databases without the complexity.
                  EasySchema lets you describe your needs and instantly creates
                  a production-ready database—no coding required."
                </p>

                <div className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full pl-5 pr-3 text-base"
                  >
                    <Link href="#link">
                      <span className="text-nowrap">Start Building</span>
                      <ChevronRight className="ml-1" />
                    </Link>
                  </Button>
                  <Button
                    key={2}
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full px-5 text-base hover:bg-zinc-950/5 dark:hover:bg-white/5"
                  >
                    <Link href="#link">
                      <span className="text-nowrap">Analyze</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            <div className="aspect-2/3 absolute inset-1 -z-10 overflow-hidden rounded-3xl border border-black/10 lg:aspect-video lg:rounded-[3rem] dark:border-white/5">
              <video
                autoPlay
                loop
                className="size-full object-cover opacity-50 invert dark:opacity-35 dark:invert-0 dark:lg:opacity-75"
                src="https://ik.imagekit.io/lrigu76hy/tailark/dna-video.mp4?updatedAt=1745736251477"
              ></video>
            </div>
          </div>
        </section>

        {/* Feature Intelligence Carousel Section */}
        <FeatureIntelligenceCarousel />
      </main>
    </>
  );
}
