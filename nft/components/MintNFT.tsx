import { useState } from 'react'

const mintNFT = ({ onMintNFT } : any) => {

    const [address, setAddress] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [img, setImg] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onMintNFT([address, name, description, img])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Destination Wallet Address</b> 
                <br></br>
                <input name='address' type='text' id='address' placeholder='Enter Destination Wallet Address' 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                <b>NFT Token Name</b> 
                <br></br>
                <input name='name' type='text' id='name' placeholder='Enter NFT Token Name' 
                value={name}
                onChange={(e) => setName(e.target.value)}
                />
                <p></p>
            </div>
            <div>
                <b>NFT Description</b> 
                <br></br>
                <input name='description' type='text' id='description' placeholder='Enter NFT Description' 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                />
                <p></p>
            </div>
            <div>
                <b>NFT Image</b> 
                <br></br>
                <input name='img' type='text' id='img' placeholder='Enter NFT Image CID' 
                value={img}
                onChange={(e) => setImg(e.target.value)}
                />
                <p></p>
            </div>
            <br></br>                   
            <input type='submit' value='Mint NFT'/>
        </form>
    )
}

export default mintNFT