export default function HeidiLogo({ color }: { color: string }) {
    return <a aria-label="Heidi Home" href="/" className="d-inline-flex align-items-center">
        <img
            src='https://cdn.prod.website-files.com/5e4ff204e7b6f80e402d407a/669a5ab4a69be50c3a94800a_Gorgias%20Logo%20-%20Black.svg'
            alt="Gorgias"
            className="inline-block shrink-0 h-8"
            style={{ width: "auto", display: "block" }}
        />
    </a>;
}
