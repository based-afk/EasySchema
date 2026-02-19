"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from "@/components/ui/carousel";
import {
  Sparkles,
  Network,
  Search,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const features = [
  {
    id: 1,
    eyebrow: "AI-Powered Generation",
    title: "Describe Your Idea. Get a Complete Schema.",
    description:
      "Transform plain English descriptions into production-ready database schemas. No SQL knowledge required—just describe what you need.",
    icon: Sparkles,
    bullets: [
      "Natural language to schema conversion",
      "Proper relationships & constraints",
      "Best practices applied automatically",
    ],
  },
  {
    id: 2,
    eyebrow: "Visual Design",
    title: "Drag & Drop Schema Builder",
    description:
      "Design and modify your database structure with an intuitive visual canvas. See relationships between tables at a glance.",
    icon: Network,
    bullets: [
      "Visual table & relationship mapping",
      "Real-time schema validation",
      "Export to PostgreSQL, MySQL, SQLite",
    ],
  },
  {
    id: 3,
    eyebrow: "No-Code Queries",
    title: "Build Queries Visually",
    description:
      "Create complex SQL queries without writing code. Point, click, and drag to build queries that would normally take hours to write.",
    icon: Search,
    bullets: [
      "Visual JOIN builder",
      "Instant query results preview",
      "Saved query templates",
    ],
  },
  {
    id: 4,
    eyebrow: "Smart Optimization",
    title: "Performance Analysis & Recommendations",
    description:
      "Get instant feedback on schema performance with AI-powered optimization suggestions. Know bottlenecks before you deploy.",
    icon: Zap,
    bullets: [
      "Automatic index recommendations",
      "Query performance scoring",
      "Optimization impact estimation",
    ],
  },
];

export function FeatureIntelligenceCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const sectionRef = useRef(null);
  const leftColRef = useRef(null);
  const rightColRef = useRef(null);

  const leftColInView = useInView(leftColRef, { once: true, amount: 0.3 });
  const rightColInView = useInView(rightColRef, { once: true, amount: 0.3 });

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    onSelect();
    api.on("select", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const scrollTo = (index: number) => {
    api?.scrollTo(index);
  };

  const scrollPrev = () => {
    api?.scrollPrev();
  };

  const scrollNext = () => {
    api?.scrollNext();
  };

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-24 md:py-32 lg:py-40 overflow-hidden"
    >
      {/* Background radial blurs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Pipeline Navigation */}
          <motion.div
            ref={leftColRef}
            initial={{ opacity: 0, y: 30 }}
            animate={
              leftColInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
            }
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* Heading */}
            <h2 className="mt-8 max-w-2xl text-balance font-light text-4xl md:text-5xl xl:text-6xl">
              Build Databases 11x Faster with AI
            </h2>

            {/* Subtitle */}
            <p className="mt-8 max-w-2xl text-balance font-light text-lg">
              From idea to production-ready database in minutes. No SQL
              expertise required—just describe what you need.
            </p>

            {/* Pipeline Navigation */}
            <div className="space-y-2 mt-12">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const isActive = current === index;

                return (
                  <button
                    key={feature.id}
                    onClick={() => scrollTo(index)}
                    className={`group relative w-full text-left transition-all duration-300 rounded-xl p-4 ${
                      isActive ? "pl-6" : "pl-4"
                    }`}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}

                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className={`relative p-2.5 rounded-lg transition-all duration-300 ${
                          isActive
                            ? "bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                            : "bg-muted/50 group-hover:bg-muted"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 transition-colors duration-300 ${
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground/80"
                          }`}
                        />
                      </div>

                      {/* Text */}
                      <div className="flex-1">
                        <div
                          className={`text-xs font-light mb-1 transition-colors duration-300 ${
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-muted-foreground/80"
                          }`}
                        >
                          {feature.eyebrow}
                        </div>
                        <div
                          className={`text-sm font-light transition-colors duration-300 ${
                            isActive
                              ? "text-foreground"
                              : "text-foreground/70 group-hover:text-foreground/90"
                          }`}
                        >
                          {feature.title}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Right Column - Carousel */}
          <motion.div
            ref={rightColRef}
            initial={{ opacity: 0, y: 30 }}
            animate={
              rightColInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
            }
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="space-y-6"
          >
            {/* Carousel */}
            <Carousel
              setApi={setApi}
              opts={{
                loop: true,
                align: "start",
              }}
              className="w-full"
            >
              <CarouselContent>
                {features.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <CarouselItem key={feature.id}>
                      <div className="group relative rounded-[20px] p-8 transition-all duration-500 hover:-translate-y-1.5 min-h-[280px] flex flex-col bg-card/50 border border-border backdrop-blur-xl hover:border-primary/25 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] hover:bg-card/70">
                        {/* Hover effect overlay removed - using direct classes above */}

                        {/* Icon */}
                        <div className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 group-hover:shadow-[0_0_30px_hsl(var(--primary)/0.3)] transition-all duration-500">
                          <Icon className="w-7 h-7 text-primary" />
                        </div>

                        {/* Content */}
                        <div className="space-y-4 flex-1">
                          {/* Eyebrow */}
                          <div className="text-xs font-light">
                            {feature.eyebrow}
                          </div>

                          {/* Title */}
                          <h3 className="text-balance font-light text-2xl">
                            {feature.title}
                          </h3>

                          {/* Description */}
                          <p className="text-balance font-light text-lg">
                            {feature.description}
                          </p>

                          {/* Bullet points */}
                          <ul className="space-y-2 pt-2">
                            {feature.bullets.map((bullet, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm font-light"
                              >
                                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-primary" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>

            {/* Controls */}
            <div className="flex items-center justify-between pt-4">
              {/* Line indicators */}
              <div className="flex items-center gap-2">
                {features.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => scrollTo(index)}
                    className={`group relative h-1 rounded-full transition-all duration-300 overflow-hidden ${
                      current === index ? "w-8 bg-primary" : "w-4 bg-border"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    <span className="sr-only">Slide {index + 1}</span>
                  </button>
                ))}
              </div>

              {/* Arrow buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={scrollPrev}
                  className="group relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 bg-muted/50 border border-border hover:border-primary hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                </button>
                <button
                  onClick={scrollNext}
                  className="group relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 bg-muted/50 border border-border hover:border-primary hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
