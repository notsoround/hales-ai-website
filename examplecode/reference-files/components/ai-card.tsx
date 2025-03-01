import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Facebook, Twitter, Linkedin, LucideIcon } from 'lucide-react';

interface SocialIconProps {
    Icon: LucideIcon;
}

function SocialIcon({ Icon }: SocialIconProps) {
    return (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
        </div>
    );
}

interface CardProps {
    name: string;
    role: string;
    imageUrl: string;
    link?: string;
}

export default function AiCard({ name, role, imageUrl, link }: CardProps) {
    const cardContentElement = (
        <CardContent className="p-0 flex backdrop-blur-sm">
            {/* Image section */}
            <div className="w-1/2 aspect-square">
                <Image
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    width={300}
                    height={300}
                    priority
                />
            </div>

            {/* Content section */}
            <div className="w-1/2 p-4 flex flex-col justify-between">
                <div>
                    <h3 className="text-sm font-normal mb-1 gradient-text">{role}</h3>
                    <h2 className="text-xl font-bold mb-2 gradient-text">{name}</h2>
                </div>

                {/* Social icons */}
                <div className="flex gap-2">
                    <SocialIcon Icon={Facebook} />
                    <SocialIcon Icon={Twitter} />
                    <SocialIcon Icon={Linkedin} />
                </div>
            </div>
        </CardContent>
    );

    return (
        <Card className="w-full text-white overflow-hidden border border-[#30c89e] rounded-lg bg-black/50 hover:border-[#41a1e0] transition-all duration-300 shadow-lg shadow-black/20">
            {link ? (
                <Link href={link}>{cardContentElement}</Link>
            ) : cardContentElement}
        </Card>
    );
}
